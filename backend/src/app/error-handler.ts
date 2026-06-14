import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error.js";
import { getRequestId } from "../shared/http/request-id.js";
import { logger } from "../infrastructure/observability/logger.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = getRequestId(res);

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        requestId,
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId
      }
    });
    return;
  }

  logger.error({ err: error, requestId, path: req.path }, "Unhandled request error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId
    }
  });
};
