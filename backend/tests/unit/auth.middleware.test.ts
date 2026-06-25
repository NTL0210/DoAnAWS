import { describe, expect, it, vi } from "vitest";
import {
  authenticate,
  requireWorkspaceRole,
} from "../../src/modules/auth/auth.middleware.js";
import type { MockWorkspaceRepository } from "../../src/modules/auth/workspace.repository.mock.js";
import type { AuthUser } from "../../src/modules/auth/auth.types.js";

// ── Helpers ────────────────────────────────────────────────────

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    path: "/api/v1/tasks",
    query: {},
    user: undefined,
    ...overrides,
  } as any;
}

function mockRes() {
  const state: { statusCode?: number; body?: unknown } = {};
  const json = vi.fn((body: unknown) => {
    state.body = body;
    return res;
  });
  const status = vi.fn((code: number) => {
    state.statusCode = code;
    return res;
  });
  const res = {
    status,
    json,
    locals: { requestId: "req-1" },
    on: vi.fn((_e: string, _cb: () => void) => res),
  };
  return { res, state };
}

function mockNext() {
  return vi.fn();
}

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    userId: "user-1",
    email: "admin@company.com",
    systemRole: "ADMIN",
    workspaceId: "ws-1",
    ...overrides,
  };
}

// ── authenticate ──────────────────────────────────────────────

describe("authenticate middleware", () => {
  it("skips auth for /healthz", () => {
    const req = mockReq({ path: "/healthz" });
    const { res } = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("skips auth for /readyz", () => {
    const req = mockReq({ path: "/readyz" });
    const { res } = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when Authorization header is missing", () => {
    const req = mockReq({ headers: {} });
    const { res, state } = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect((state.body as any)?.error?.code).toBe("AUTH_REQUIRED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is not Bearer", () => {
    const req = mockReq({ headers: { authorization: "Basic abc123" } });
    const { res, state } = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect((state.body as any)?.error?.code).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when token is invalid", async () => {
    const req = mockReq({ headers: { authorization: "Bearer not-a-token" } });
    const { res, state } = mockRes();
    const next = mockNext();

    authenticate(req, res, next);

    // authenticate is async internally; wait for promise to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(res.status).toHaveBeenCalledWith(401);
    expect((state.body as any)?.error?.code).toBe("AUTH_INVALID_TOKEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches user to req for a valid mock token", async () => {
    // Generate a valid mock token inline
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
      "utf8",
    ).toString("base64");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        role: "ADMIN",
        email: "admin@company.com",
        workspaceId: "ws-1",
      }),
      "utf8",
    ).toString("base64");
    const token = `${header}.${payload}.mock-signature`;

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const { res } = mockRes();
    const next = mockNext();

    authenticate(req, res, next);
    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe("user-1");
  });
});

// ── requireWorkspaceRole ──────────────────────────────────────

describe("requireWorkspaceRole middleware", () => {
  it("returns 401 when req.user is missing", async () => {
    const repo = { getMemberRole: vi.fn() } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({ user: undefined });
    const { res, state } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect((state.body as any)?.error?.code).toBe("AUTH_REQUIRED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when workspaceId cannot be resolved", async () => {
    const repo = { getMemberRole: vi.fn() } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({
      user: makeAuthUser({ workspaceId: undefined }),
      // no x-workspace-id header, no query param
    });
    const { res, state } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect((state.body as any)?.error?.code).toBe("WORKSPACE_REQUIRED");
  });

  it("returns 403 when user is not a workspace member", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue(null),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({
      user: makeAuthUser(),
      headers: { "x-workspace-id": "ws-1" },
    });
    const { res, state } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect((state.body as any)?.error?.code).toBe("FORBIDDEN");
    expect((state.body as any)?.error?.message).toContain("not a member");
  });

  it("returns 403 when user role is insufficient", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue("MEMBER"),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "ADMIN");

    const req = mockReq({
      user: makeAuthUser(),
      headers: { "x-workspace-id": "ws-1" },
    });
    const { res, state } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect((state.body as any)?.error?.code).toBe("FORBIDDEN");
    expect((state.body as any)?.error?.message).toContain("Insufficient permissions");
  });

  it("allows MEMBER access for MEMBER-guarded route", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue("MEMBER"),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({
      user: makeAuthUser(),
      headers: { "x-workspace-id": "ws-1" },
    });
    const { res } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.workspaceRole).toBe("MEMBER");
    expect(res.locals.workspaceId).toBe("ws-1");
  });

  it("allows ADMIN access for ADMIN-guarded route", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue("ADMIN"),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "ADMIN");

    const req = mockReq({
      user: makeAuthUser(),
      headers: { "x-workspace-id": "ws-1" },
    });
    const { res } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("allows OWNER access to ADMIN-guarded route (hierarchy)", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue("OWNER"),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "ADMIN");

    const req = mockReq({
      user: makeAuthUser(),
      headers: { "x-workspace-id": "ws-1" },
    });
    const { res } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("resolves workspaceId from x-workspace-id header", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue("MEMBER"),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({
      user: makeAuthUser({ workspaceId: undefined }),
      headers: { "x-workspace-id": "ws-2" },
    });
    const { res } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.workspaceId).toBe("ws-2");
  });

  it("resolves workspaceId from query param", async () => {
    const repo = {
      getMemberRole: vi.fn().mockResolvedValue("MEMBER"),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({
      user: makeAuthUser({ workspaceId: undefined }),
      headers: {},
      query: { workspaceId: "ws-3" },
    });
    const { res } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.workspaceId).toBe("ws-3");
  });

  it("forwards caught errors to next()", async () => {
    const repo = {
      getMemberRole: vi.fn().mockRejectedValue(new Error("DB down")),
    } as any as MockWorkspaceRepository;
    const middleware = requireWorkspaceRole(repo, "MEMBER");

    const req = mockReq({
      user: makeAuthUser(),
      headers: { "x-workspace-id": "ws-1" },
    });
    const { res } = mockRes();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "DB down" }));
  });
});
