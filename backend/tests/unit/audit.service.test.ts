import { describe, expect, it, vi } from "vitest";
import { AuditService } from "../../src/modules/audit/audit.service.js";
import { MockAuditRepository } from "../../src/modules/audit/audit.repository.mock.js";

describe("AuditService", () => {
  it("records an event with generated id and timestamp", async () => {
    const repo = new MockAuditRepository();
    const service = new AuditService(repo);

    const event = await service.record({
      workspaceId: "ws-1",
      action: "MEETING.CREATED",
      performedBy: "user-1",
      targetType: "meeting",
      targetId: "m-1",
    });

    expect(event.id).toBeTypeOf("string");
    expect(event.createdAt).toBeTypeOf("string");
    expect(event.workspaceId).toBe("ws-1");
    expect(event.action).toBe("MEETING.CREATED");
    expect(event.performedBy).toBe("user-1");
    expect(event.targetId).toBe("m-1");
  });

  it("includes optional details when provided", async () => {
    const repo = new MockAuditRepository();
    const service = new AuditService(repo);

    const event = await service.record({
      workspaceId: "ws-1",
      action: "TASK.UPDATED",
      performedBy: "user-2",
      targetType: "task",
      targetId: "t-1",
      details: { field: "status", old: "PENDING", new: "COMPLETED" },
    });

    expect(event.details).toEqual({
      field: "status",
      old: "PENDING",
      new: "COMPLETED",
    });
  });

  it("listByWorkspace returns paginated results", async () => {
    const repo = new MockAuditRepository();
    const service = new AuditService(repo);

    for (let i = 0; i < 3; i++) {
      await service.record({
        workspaceId: "ws-1",
        action: "MEETING.CREATED",
        performedBy: "user-1",
        targetType: "meeting",
        targetId: `m-${i}`,
      });
    }

    const result = await service.listByWorkspace({
      workspaceId: "ws-1",
      limit: 2,
    });
    expect(result.items).toHaveLength(2);
    expect(result.nextToken).toBeTypeOf("string");
  });

  it("listByWorkspace returns empty for unknown workspace", async () => {
    const repo = new MockAuditRepository();
    const service = new AuditService(repo);

    const result = await service.listByWorkspace({
      workspaceId: "ws-404",
      limit: 10,
    });
    expect(result.items).toEqual([]);
  });

  it("delegates to repository for listByWorkspace", async () => {
    const repo = new MockAuditRepository();
    const spy = vi.spyOn(repo, "listByWorkspace");
    const service = new AuditService(repo);

    await service.listByWorkspace({ workspaceId: "ws-1", limit: 5 });

    expect(spy).toHaveBeenCalledWith({ workspaceId: "ws-1", limit: 5 });
  });
});
