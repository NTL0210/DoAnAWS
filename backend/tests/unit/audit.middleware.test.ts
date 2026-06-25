import { describe, expect, it, vi } from "vitest";
import { audit } from "../../src/modules/audit/audit.middleware.js";
import { MockAuditRepository } from "../../src/modules/audit/audit.repository.mock.js";

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    params: {},
    user: { userId: "user-1" },
    ...overrides,
  } as any;
}

function mockRes() {
  let finishCb: (() => void) | null = null;
  const res = {
    locals: { requestId: "req-1", workspaceId: "ws-1" },
    statusCode: 200,
    on: vi.fn((event: string, cb: () => void) => {
      if (event === "finish") finishCb = cb;
      return res;
    }),
    // Trigger the finish callback synchronously
    emitFinish() {
      finishCb?.();
    },
  };
  return res;
}

function mockNext() {
  return vi.fn();
}

describe("audit middleware factory", () => {
  it("calls next immediately without waiting", () => {
    const repo = new MockAuditRepository();
    const middleware = audit("TASK.DELETED", "task", repo);

    const req = mockReq({ params: { id: "task-1" } });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("records an audit event on successful response (2xx)", async () => {
    const repo = new MockAuditRepository();
    const middleware = audit("TASK.DELETED", "task", repo);

    const req = mockReq({ params: { id: "task-42" } });
    const res = mockRes();
    res.statusCode = 200;
    const next = mockNext();

    middleware(req, res, next);
    res.emitFinish();

    // Wait for the async create to complete
    await new Promise((r) => setTimeout(r, 10));

    const events = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(events.items).toHaveLength(1);
    expect(events.items[0]!.action).toBe("TASK.DELETED");
    expect(events.items[0]!.targetId).toBe("task-42");
    expect(events.items[0]!.performedBy).toBe("user-1");
  });

  it("does not record on non-2xx responses (4xx)", async () => {
    const repo = new MockAuditRepository();
    const middleware = audit("MEETING.CREATED", "meeting", repo);

    const req = mockReq({ params: { id: "m-1" } });
    const res = mockRes();
    res.statusCode = 400;
    const next = mockNext();

    middleware(req, res, next);
    res.emitFinish();

    await new Promise((r) => setTimeout(r, 10));

    const events = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(events.items).toHaveLength(0);
  });

  it("extracts targetId from req.params.id as string", async () => {
    const repo = new MockAuditRepository();
    const middleware = audit("USER.UPDATED", "user", repo);

    const req = mockReq({ params: { id: "user-99" } });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);
    res.emitFinish();

    await new Promise((r) => setTimeout(r, 10));

    const events = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(events.items[0]!.targetId).toBe("user-99");
  });

  it("never throws even if repo.create rejects", async () => {
    const failingRepo = {
      create: vi.fn().mockRejectedValue(new Error("DB error")),
      listByWorkspace: vi.fn(),
    } as any;
    const middleware = audit("MEETING.DELETED", "meeting", failingRepo);

    const req = mockReq({ params: { id: "m-99" } });
    const res = mockRes();
    const next = mockNext();

    middleware(req, res, next);
    res.emitFinish();

    await new Promise((r) => setTimeout(r, 10));

    // Middleware should swallow the error — next was already called
    expect(next).toHaveBeenCalledOnce();
  });

  it("records with workspaceId from res.locals", async () => {
    const repo = new MockAuditRepository();
    const middleware = audit("MEMBER.ADDED", "member", repo);

    const req = mockReq({ params: { id: "new-user" } });
    const res = mockRes();
    res.locals.workspaceId = "ws-42";
    const next = mockNext();

    middleware(req, res, next);
    res.emitFinish();

    await new Promise((r) => setTimeout(r, 10));

    const events = await repo.listByWorkspace({ workspaceId: "ws-42", limit: 10 });
    expect(events.items).toHaveLength(1);
    expect(events.items[0]!.workspaceId).toBe("ws-42");
  });
});
