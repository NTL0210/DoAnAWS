import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import helmet from "helmet";
import { ddb } from "../infrastructure/aws/dynamodb-client.js";
import { logger } from "../infrastructure/observability/logger.js";
import { authenticate } from "../modules/auth/auth.middleware.js";
import { requestIdMiddleware } from "../shared/http/request-id.js";
import { errorHandler } from "./error-handler.js";
import { buildRepositories, type Repositories } from "./repositories.js";
import { buildApiRouter } from "./routes.js";

function accessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = performance.now();
  res.on("finish", () => {
    logger.info(
      {
        requestId: res.locals.requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt)
      },
      "HTTP request completed",
    );
  });
  next();
}

export function createApp(repositories: Repositories = buildRepositories()) {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Workspace-Id", "X-Request-Id"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware);
  app.use(accessLogMiddleware);

  // Public endpoints — must register before global auth middleware
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    void ddb;
    res.status(200).json({ status: "ready" });
  });

  // Global auth — every route after this requires a valid JWT
  app.use(authenticate);

  app.use("/api/v1", buildApiRouter(repositories));
  app.use(errorHandler);

  return app;
}

const DEFAULT_PRODUCTION_ORIGINS = [
  "https://d1gdsnv8exdah.cloudfront.net",
];

const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/,
];

function configuredOrigins(): Set<string> {
  const configured = process.env.ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || "";
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(origins.length ? origins : DEFAULT_PRODUCTION_ORIGINS);
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (configuredOrigins().has(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    return DEV_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
  }
  return false;
}
