import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const requestIdHeader = "x-request-id";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existing = req.header(requestIdHeader);
  const requestId = existing && existing.length <= 128 ? existing : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader(requestIdHeader, requestId);
  next();
}

export function getRequestId(res: Response): string {
  const value: unknown = res.locals.requestId;
  return typeof value === "string" ? value : "unknown";
}
