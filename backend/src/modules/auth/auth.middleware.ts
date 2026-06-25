import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./auth.jwt.js";
import { hasSufficientRole, WORKSPACE_ROLES } from "./auth.types.js";
import type { WorkspaceRole } from "./auth.types.js";
import type { WorkspaceRepository } from "./workspace.repository.js";

// ─── Authenticate Middleware ───────────────────────────────

/**
 * Express middleware that extracts and verifies a Bearer JWT token.
 * Attaches the decoded user to `req.user`.
 * Whitelisted paths skip verification.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health/readiness endpoints
  if (req.path === "/healthz" || req.path === "/readyz") {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "AUTH_REQUIRED",
        message: "Authentication required",
        requestId: res.locals.requestId,
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  verifyToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => {
      res.status(401).json({
        error: {
          code: "AUTH_INVALID_TOKEN",
          message: "Invalid or expired token",
          requestId: res.locals.requestId,
        },
      });
    });
}

// ─── Workspace Authorization Guard ────────────────────────

/**
 * Middleware factory that checks workspace membership role.
 * Requires `authenticate` to have run first (sets req.user).
 *
 * @param workspaceRepo - repository to look up workspace membership
 * @param requiredRoles - one or more roles that are allowed (checked hierarchically)
 */
export function requireWorkspaceRole(
  workspaceRepo: WorkspaceRepository,
  ...requiredRoles: WorkspaceRole[]
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required",
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      // Extract workspaceId from header (x-workspace-id), query, or user context
      const workspaceId =
        (req.headers["x-workspace-id"] as string | undefined) ||
        (req.query.workspaceId as string | undefined) ||
        req.user.workspaceId;

      if (!workspaceId) {
        res.status(400).json({
          error: {
            code: "WORKSPACE_REQUIRED",
            message:
              "Workspace ID is required. Provide x-workspace-id header or workspaceId query param.",
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      const userRole = await workspaceRepo.getMemberRole(workspaceId, req.user.userId);

      if (!userRole) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You are not a member of this workspace",
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      if (!WORKSPACE_ROLES.includes(userRole)) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Invalid workspace role",
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      // Check hierarchy: user's role must be >= at least one required role
      const hasAccess = requiredRoles.some((required) =>
        hasSufficientRole(userRole, required),
      );

      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: `Insufficient permissions. Required: ${requiredRoles.join(" or ")}`,
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      res.locals.workspaceRole = userRole;
      res.locals.workspaceId = workspaceId;
      next();
    } catch (error) {
      next(error);
    }
  };
}
