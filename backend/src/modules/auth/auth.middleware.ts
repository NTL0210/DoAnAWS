import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./auth.jwt.js";
import { getBuiltInRolePermissions } from "./auth.permissions.js";
import type { WorkspacePermission } from "./auth.permissions.js";
import { hasSufficientRole, WORKSPACE_ROLES } from "./auth.types.js";
import type { WorkspaceRole } from "./auth.types.js";
import type { WorkspaceRepository } from "./workspace.repository.js";

export type WorkspaceRequirement = WorkspaceRole | `permission:${WorkspacePermission}`;

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
  ...requirements: WorkspaceRequirement[]
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

      // Extract workspaceId from explicit workspace fields before generic route ids.
      // Routes like /meetings/:id use params.id for a meeting id, not a workspace id.
      const workspaceId =
        (req.headers["x-workspace-id"] as string | undefined) ||
        (req.query.workspaceId as string | undefined) ||
        (isRecord(req.body) && typeof req.body.workspaceId === "string"
          ? req.body.workspaceId
          : undefined) ||
        (req.params.workspaceId as string | undefined) ||
        (req.params.id as string | undefined) ||
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

      const authorization = workspaceRepo.getMemberAuthorization
        ? await workspaceRepo.getMemberAuthorization(workspaceId, req.user.userId)
        : await legacyAuthorization(workspaceRepo, workspaceId, req.user.userId);

      if (!authorization) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You are not a member of this workspace",
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      const requiredPermissions = requirements
        .filter((requirement): requirement is `permission:${WorkspacePermission}` => requirement.startsWith("permission:"))
        .map((requirement) => requirement.slice("permission:".length) as WorkspacePermission);
      const requiredRoles = requirements.filter((requirement): requirement is WorkspaceRole =>
        !requirement.startsWith("permission:"),
      );
      const hasAccess = authorization.effectiveRole === "OWNER" || (
        requiredPermissions.length > 0
          ? requiredPermissions.some((permission) => authorization.permissions.includes(permission))
          : requiredRoles.some((required) => hasSufficientRole(authorization.effectiveRole, required))
      );

      if (!hasAccess) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: `Insufficient permissions. Required: ${requirements.join(" or ")}`,
            requestId: res.locals.requestId,
          },
        });
        return;
      }

      res.locals.workspaceRole = authorization.effectiveRole;
      res.locals.workspaceRoleId = authorization.roleId;
      res.locals.workspacePermissions = authorization.permissions;
      res.locals.workspaceId = workspaceId;
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function legacyAuthorization(
  workspaceRepo: WorkspaceRepository,
  workspaceId: string,
  userId: string,
) {
  const roleId = await workspaceRepo.getMemberRole(workspaceId, userId);
  if (!roleId || !WORKSPACE_ROLES.includes(roleId as WorkspaceRole)) return null;
  const effectiveRole = roleId as WorkspaceRole;
  return {
    roleId,
    effectiveRole,
    permissions: getBuiltInRolePermissions(effectiveRole),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
