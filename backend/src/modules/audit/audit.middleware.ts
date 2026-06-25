import type { Request, Response, NextFunction } from "express";
import type { AuditAction, AuditEvent } from "./audit.types.js";
import type { AuditRepository } from "./audit.repository.js";

/**
 * Express middleware that records an audit event after a successful response.
 *
 * Usage:
 * ```ts
 * router.delete("/:id", audit("TASK.DELETED", "task"), controller.delete);
 * ```
 * The target ID is extracted from `req.params.id` by default.
 */
export function audit(
  action: AuditAction,
  targetType: string,
  repo: AuditRepository,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Listen for the response to finish so we capture the status code.
    res.on("finish", () => {
      // Only record 2xx responses
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const event: AuditEvent = {
        id: crypto.randomUUID(),
        workspaceId: res.locals.workspaceId ?? "",
        action,
        performedBy: req.user?.userId ?? "unknown",
        targetType,
        targetId: typeof req.params.id === "string" ? req.params.id : req.params.id?.[0] ?? "",
        createdAt: new Date().toISOString(),
      };

      repo.create(event).catch(() => {
        // Fire-and-forget: never let audit logging fail the request.
      });
    });

    next();
  };
}
