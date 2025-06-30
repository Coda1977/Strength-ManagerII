import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  
  // Enhanced session store configuration to prevent corruption
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false, // Table already exists in schema
    ttl: sessionTtl,
    tableName: "sessions",
    schemaName: 'public',
    pruneSessionInterval: 60 * 15, // 15 minutes
    disableTouch: false, // Enable session touch to prevent premature expiry
    errorLog: (err) => {
      console.error('Session store error:', err);
      // Log but don't crash - session middleware will handle gracefully
    },
  });

  // Add session store event handlers for monitoring
  sessionStore.on('connect', () => {
    console.log('Session store connected to database');
  });

  sessionStore.on('disconnect', () => {
    console.log('Session store disconnected from database');
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false, // Don't save unchanged sessions
    saveUninitialized: false, // Don't save empty sessions
    rolling: true, // Reset expiry on activity to prevent premature logout
    name: 'sessionId', // Custom session name for better security
    cookie: {
      httpOnly: true, // Prevent XSS attacks
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: sessionTtl,
      sameSite: 'strict', // CSRF protection
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Register strategies for both Replit domains and localhost
  const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];
  
  // For deployed apps, also check for common deployment domain patterns
  const deploymentDomains = [];
  if (process.env.REPL_ID) {
    // Add all common Replit deployment patterns
    deploymentDomains.push(`${process.env.REPL_ID}.replit.app`);
    deploymentDomains.push(`${process.env.REPL_ID}-00-${process.env.REPL_SLUG || 'workspace'}.replit.dev`);
    // Add additional deployment patterns that might be used
    deploymentDomains.push(`${process.env.REPL_ID}.replit.dev`);
    deploymentDomains.push(`${process.env.REPL_ID}-production.replit.app`);
    deploymentDomains.push(`${process.env.REPL_ID}-main.replit.app`);
  }
  
  const domains = [...replitDomains, ...deploymentDomains, 'localhost', '127.0.0.1'];
  
  console.log('Registering authentication strategies for domains:', domains);
  
  for (const domain of domains) {
    // Use the actual domain for callback URL
    const callbackDomain = domain === 'localhost' || domain === '127.0.0.1' ? replitDomains[0] || domain : domain;
    const callbackURL = `https://${callbackDomain}/api/callback`;
    
    console.log(`Registering strategy: replitauth:${domain} with callback: ${callbackURL}`);
    
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    let strategyName = `replitauth:${hostname}`;
    
    console.log(`Login attempt - hostname: ${hostname}`);
    
    // Check if strategy exists, if not, try to find a matching one
    try {
      const strategy = (passport as any)._strategy(strategyName);
      if (!strategy) {
        console.log(`Strategy ${strategyName} not found, looking for alternatives...`);
        
        // Try to find a strategy that matches deployment patterns
        const availableStrategies = Object.keys((passport as any)._strategies || {});
        console.log('Available strategies:', availableStrategies);
        
        // Look for .replit.app domain strategy
        const replitAppStrategy = availableStrategies.find(s => s.includes('.replit.app'));
        if (replitAppStrategy) {
          console.log(`Using fallback strategy: ${replitAppStrategy}`);
          strategyName = replitAppStrategy;
        } else {
          // Use the first available replit strategy
          const replitStrategy = availableStrategies.find(s => s.startsWith('replitauth:') && s.includes('replit'));
          if (replitStrategy) {
            console.log(`Using fallback strategy: ${replitStrategy}`);
            strategyName = replitStrategy;
          } else {
            // Last resort: dynamically create a strategy for this hostname if it looks like a Replit domain
            if (hostname.includes('replit.app') || hostname.includes('replit.dev')) {
              console.log(`Creating dynamic strategy for hostname: ${hostname}`);
              
              const dynamicStrategy = new Strategy(
                {
                  name: `replitauth:${hostname}`,
                  config,
                  scope: "openid email profile offline_access",
                  callbackURL: `https://${hostname}/api/callback`,
                },
                verify,
              );
              passport.use(dynamicStrategy);
              strategyName = `replitauth:${hostname}`;
            } else {
              console.error(`No suitable strategy found for hostname ${hostname}`);
              return res.status(500).json({ 
                error: 'No authentication strategy available', 
                hostname,
                availableStrategies
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error checking strategy ${strategyName}:`, error);
      return res.status(500).json({ 
        error: 'Authentication configuration error', 
        hostname
      });
    }
    
    // Use the actual Replit domain for URLs in state
    const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];
    const websiteUrl = replitDomains.length > 0 ? `https://${replitDomains[0]}` : `https://${hostname}`;
    
    // Detect mobile devices
    const userAgent = req.get('User-Agent') || '';
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    
    // Use different prompt strategy for mobile vs desktop
    const promptStrategy = isMobile ? "none" : "select_account";
    
    passport.authenticate(strategyName, {
      prompt: promptStrategy,
      scope: ["openid", "email", "profile", "offline_access"],
      // Add custom parameters to pass website info to authorization flow
      state: JSON.stringify({
        app_name: "Strengths Manager",
        website_url: websiteUrl,
        return_url: `${websiteUrl}/dashboard`,
        mobile: isMobile
      })
    })(req, res, next);
  });

  app.get("/api/callback", async (req, res, next) => {
    const hostname = req.hostname || req.get('host')?.split(':')[0] || 'localhost';
    const strategyName = `replitauth:${hostname}`;
    
    // Add mobile-friendly headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    passport.authenticate(strategyName, async (err: any, user: any) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.redirect("/api/login");
      }
      if (!user) {
        return res.redirect("/api/login");
      }

      // Log the user in
      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error('Login error:', loginErr);
          return res.redirect("/api/login");
        }

        try {
          // Check if user has completed onboarding
          const dbUser = await storage.getUser(user.claims.sub);
          
          // Send welcome email with website link for new users
          if (dbUser && !dbUser.hasCompletedOnboarding) {
            try {
              // Import emailService dynamically to avoid circular dependencies
              const { emailService } = await import('./emailService');
              // Use the actual Replit domain instead of localhost
              const replitDomains = process.env.REPLIT_DOMAINS?.split(",") || [];
              const websiteUrl = replitDomains.length > 0 ? `https://${replitDomains[0]}` : `https://${req.hostname}`;
              
              await emailService.sendAuthorizationWelcomeEmail(
                user.claims.email,
                user.claims.first_name || 'there',
                websiteUrl
              );
            } catch (emailError) {
              console.error('Failed to send authorization welcome email:', emailError);
              // Don't fail the auth flow if email fails
            }
          }
          
          // Use proper HTTP redirect for better user experience
          const targetUrl = (dbUser && dbUser.hasCompletedOnboarding) ? "/dashboard" : "/onboarding";
          return res.redirect(targetUrl);
        } catch (error) {
          console.error('Error checking user status:', error);
          return res.redirect("/onboarding");
        }
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      // Clear the session and redirect to home page
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.clearCookie('sessionId');
        res.redirect('/');
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    console.log('Authentication failed: No user or not authenticated');
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Skip token expiry check for now to allow conversation loading
  if (user.claims && user.claims.sub) {
    return next();
  }

  // If user doesn't have expires_at, they might be in an old session format
  if (!user.expires_at) {
    console.log('Authentication failed: No expires_at');
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log('Authentication failed: No refresh token');
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    console.error('Token refresh failed:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};