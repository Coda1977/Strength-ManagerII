import passport from "passport";
import { Strategy as Auth0Strategy } from "passport-auth0";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Environment variables validation
if (!process.env.AUTH0_DOMAIN) {
  throw new Error("AUTH0_DOMAIN environment variable is required");
}
if (!process.env.AUTH0_CLIENT_ID) {
  throw new Error("AUTH0_CLIENT_ID environment variable is required");
}
if (!process.env.AUTH0_CLIENT_SECRET) {
  throw new Error("AUTH0_CLIENT_SECRET environment variable is required");
}
if (!process.env.AUTH0_CALLBACK_URL) {
  throw new Error("AUTH0_CALLBACK_URL environment variable is required");
}

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
      secure: process.env.NODE_ENV === 'production', // Secure only in production
      maxAge: sessionTtl,
      sameSite: 'lax', // More compatible setting
    },
  });
}

interface Auth0User {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

async function upsertUser(auth0User: Auth0User) {
  // Map Auth0 user data to our user schema
  const userData = {
    id: auth0User.id, // Auth0 user ID
    email: auth0User.email || (auth0User.emails && auth0User.emails[0]?.value) || '',
    firstName: auth0User.given_name || auth0User.displayName?.split(' ')[0] || '',
    lastName: auth0User.family_name || auth0User.displayName?.split(' ').slice(1).join(' ') || '',
    profileImageUrl: auth0User.picture || (auth0User.photos && auth0User.photos[0]?.value),
  };

  // Check if this is a new user
  const existingUser = await storage.getUser(userData.id);
  const isNewUser = !existingUser;
  
  const user = await storage.upsertUser(userData);

  // Send authorization welcome email for new users
  if (isNewUser && userData.email && userData.firstName) {
    try {
      const { emailService } = await import('./emailService');
      const websiteUrl = process.env.AUTH0_CALLBACK_URL?.split('/api')[0] || 'https://your-app.replit.dev';
      
      await emailService.sendAuthorizationWelcomeEmail(
        userData.email, 
        userData.firstName, 
        websiteUrl
      );
      console.log(`Authorization welcome email sent to new user: ${userData.email}`);
    } catch (error) {
      console.error('Failed to send authorization welcome email:', error);
      // Don't fail the authentication flow if email fails
    }
  }

  return user;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Auth0 Strategy
  console.log('=== AUTH0 CONFIGURATION DEBUG ===');
  console.log('AUTH0_DOMAIN:', process.env.AUTH0_DOMAIN);
  console.log('AUTH0_CLIENT_ID:', process.env.AUTH0_CLIENT_ID);
  console.log('AUTH0_CLIENT_SECRET:', process.env.AUTH0_CLIENT_SECRET ? 'SET' : 'MISSING');
  console.log('AUTH0_CALLBACK_URL:', process.env.AUTH0_CALLBACK_URL);
  
  const strategy = new Auth0Strategy(
    {
      domain: process.env.AUTH0_DOMAIN!,
      clientID: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      callbackURL: process.env.AUTH0_CALLBACK_URL!
    },
    async (accessToken: string, refreshToken: string, extraParams: any, profile: Auth0User, done: any) => {
      try {
        console.log('=== AUTH0 STRATEGY DEBUG ===');
        console.log('Profile received:', profile);
        console.log('Access token exists:', !!accessToken);
        
        // Upsert user in database
        console.log('Attempting to upsert user...');
        const user = await upsertUser(profile);
        console.log('User upserted successfully:', user.id);
        
        // Create session user object
        const sessionUser = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          hasCompletedOnboarding: user.hasCompletedOnboarding,
          isAdmin: user.isAdmin,
          accessToken,
          refreshToken,
          profile
        };

        console.log('Session user created:', sessionUser.id);
        return done(null, sessionUser);
      } catch (error) {
        console.error('=== AUTH0 STRATEGY ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        return done(error, null);
      }
    }
  );

  passport.use(strategy);

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  // Auth routes
  app.get("/api/login", (req, res, next) => {
    console.log('=== LOGIN REQUEST DEBUG ===');
    console.log('Request host:', req.get('host'));
    console.log('Request origin:', req.get('origin'));
    console.log('Request referer:', req.get('referer'));
    console.log('Request protocol:', req.protocol);
    console.log('Full URL:', `${req.protocol}://${req.get('host')}${req.originalUrl}`);
    
    passport.authenticate('auth0', {
      scope: 'openid email profile'
    })(req, res, next);
  });

  app.get("/api/auth/callback", 
    passport.authenticate('auth0', { 
      failureRedirect: '/api/login',
      failureFlash: false 
    }),
    async (req, res) => {
      try {
        console.log('=== AUTH CALLBACK DEBUG ===');
        console.log('User object:', req.user);
        
        const user = req.user as any;
        
        if (!user) {
          console.error('No user object in callback');
          return res.redirect("/api/login");
        }

        console.log('User ID:', user.id);
        console.log('Checking user in database...');

        // Check if user has completed onboarding
        const dbUser = await storage.getUser(user.id);
        console.log('Database user:', dbUser);
        
        if (dbUser && dbUser.hasCompletedOnboarding) {
          console.log('User has completed onboarding, redirecting to dashboard');
          return res.redirect("/dashboard");
        } else {
          console.log('User needs onboarding, redirecting to onboarding');
          return res.redirect("/onboarding");
        }
      } catch (error) {
        console.error('=== CALLBACK ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ 
          message: 'Authentication callback failed', 
          error: error.message 
        });
      }
    }
  );

  // Emergency admin login bypass (for Auth0 issues)
  app.post("/api/admin-login", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || email !== 'codanudge@gmail.com') {
        return res.status(403).json({ message: 'Unauthorized admin access' });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.isAdmin) {
        return res.status(403).json({ message: 'Admin user not found' });
      }

      // Create a mock session for admin
      const sessionUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        isAdmin: user.isAdmin
      };

      req.login(sessionUser, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed', error: err.message });
        }
        res.json({ message: 'Admin login successful', redirectTo: '/dashboard' });
      });

    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Admin login failed' });
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      // Clear the session and redirect to Auth0 logout
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error('Session destruction error:', sessionErr);
        }
        res.clearCookie('sessionId');
        
        // Redirect to Auth0 logout URL
        const logoutURL = new URL(`https://${process.env.AUTH0_DOMAIN}/v2/logout`);
        logoutURL.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!);
        logoutURL.searchParams.set('returnTo', process.env.AUTH0_CALLBACK_URL?.split('/api')[0] || 'https://your-app.replit.dev');
        
        res.redirect(logoutURL.toString());
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

  // For Auth0 users, we have the user data in session
  if (user.id) {
    return next();
  }

  console.log('Authentication failed: Invalid user session');
  return res.status(401).json({ message: "Unauthorized" });
};