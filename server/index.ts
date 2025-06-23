import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { errorHandler } from "./errorHandler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Enhanced error logging with context
      console.error('Server error:', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        url: _req.url,
        method: _req.method,
        timestamp: new Date().toISOString()
      });

      // Don't expose internal errors in production
      const responseMessage = process.env.NODE_ENV === 'production' && status === 500 
        ? "Internal Server Error" 
        : message;

      res.status(status).json({ message: responseMessage });
    });

    // Setup system monitoring endpoints
    app.get('/api/system/health', async (req, res) => {
      const { resourceManager } = await import('./resourceManager');
      const { DatabaseMonitor } = await import('./db');
      
      const resourceStats = resourceManager.getResourceStats();
      const dbStats = DatabaseMonitor.getInstance().getPoolStats();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        resources: resourceStats,
        database: dbStats,
        uptime: process.uptime()
      });
    });

    // Database-specific monitoring
    app.get('/api/system/db-stats', async (req, res) => {
      const { DatabaseMonitor } = await import('./db');
      const monitor = DatabaseMonitor.getInstance();
      
      try {
        await monitor.checkPoolHealth();
        const stats = monitor.getPoolStats();
        
        res.json({
          status: 'healthy',
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    });

    // Handle server shutdown gracefully
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
