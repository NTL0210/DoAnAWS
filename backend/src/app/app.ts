import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import helmet from "helmet";
import { ddb } from "../infrastructure/aws/dynamodb-client.js";
import { logger } from "../infrastructure/observability/logger.js";
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
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestIdMiddleware);
  app.use(accessLogMiddleware);

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/readyz", async (_req, res) => {
    void ddb;
    res.status(200).json({ status: "ready" });
  });

  app.use("/api/v1", buildApiRouter(repositories));
  app.use(errorHandler);

  return app;
}
