import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "passport";
import env from "./core/config/env.js";
import { rateLimit } from "express-rate-limit";
import logger from "./core/logger/logger.js";
import { traceIdMiddleware } from "./api/middleware/traceId.middleware.js";
import { metricsMiddleware } from "./api/middleware/metrics.middleware.js";
import { metricsToPrometheus } from "./core/metrics/index.js";
import metricsCollector from "./core/metrics/metricsCollector.js";
import healthCheckService from "./core/health/healthCheck.js";
import responseMiddleware from "./api/middleware/response.middleware.js";
import timeoutMiddleware from "./api/middleware/timeout.middleware.js";

// Routes
import AuthRoutes from "./modules/auth/auth.routes.js";
import HealthRoutes from "./core/health/health.routes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./core/config/swagger.js";

class App {
  static createApp() {
    const app = express();

    // 🛡️ Middlewares
    app.use(helmet());
    app.use(cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // ✅ PHASE 6: Add trace ID middleware for observability
    app.use(traceIdMiddleware);

    // ⚡ Unified Response Formatting helper
    app.use(responseMiddleware);

    // ⏱️ Global request timeout guard (15 seconds)
    app.use(timeoutMiddleware(15000));

    // ✅ PHASE 1A: Add Prometheus metrics middleware
    app.use(metricsMiddleware);

    // 🔑 Passport
    app.use(passport.initialize());
    import("./core/config/passport.js");

    // 🚀 Rate Limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    });
    app.use("/api/", limiter);

    // 📂 Routes
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.use("/api/auth", AuthRoutes.createRouter());
  
    app.use("/api/health", HealthRoutes);

    app.get("/", (req, res) => {
      res.status(200).json({ status: "your are live", timestamp: new Date().toISOString() });
    });

    // ✅ PHASE 6: Metrics endpoint for observability
    app.get("/api/metrics", (req, res) => {
      try {
        const metrics = metricsCollector.getMetrics();
        res.status(200).json({
          status: "success",
          timestamp: new Date().toISOString(),
          traceId: req.traceId,
          metrics
        });
      } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({
          status: "error",
          message: "Failed to retrieve metrics",
          traceId: req.traceId
        });
      }
    });

    // ✅ PHASE 6: Health check endpoint for production readiness
    app.get("/api/health-check", async (req, res) => {
      try {
        const health = await healthCheckService.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 500;
        res.status(statusCode).json({
          ...health,
          traceId: req.traceId
        });
      } catch (error) {
        logger.error('Failed to get health status:', error);
        res.status(500).json({
          status: "unhealthy",
          error: error.message,
          timestamp: new Date().toISOString(),
          traceId: req.traceId
        });
      }
    });

    // ✅ PHASE 1A: Prometheus metrics endpoint
    app.get("/metrics", async (req, res) => {
      try {
        const metrics = await metricsToPrometheus();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
      } catch (error) {
        logger.error('Failed to generate Prometheus metrics:', error);
        res.status(500).send('Error generating metrics');
      }
    });

    // Centralized Error Handler (must be the last middleware)
    app.use((err, req, res, next) => {
      import("./api/middleware/errorHandler.middleware.js").then(({ default: errorHandler }) => {
        errorHandler(err, req, res, next);
      }).catch(next);
    });

    return app;
  }
}

export default App;
