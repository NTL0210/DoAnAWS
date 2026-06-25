import { describe, expect, it } from "vitest";
import { MockAuditRepository } from "../../src/modules/audit/audit.repository.mock.js";
import type { AuditEvent } from "../../src/modules/audit/audit.types.js";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "evt-1",
    workspaceId: "ws-1",
    action: "TASK.CREATED",
    performedBy: "user-1",
    targetType: "task",
    targetId: "task-1",
    createdAt: "2026-06-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("MockAuditRepository", () => {
  it("stores and retrieves events for a workspace", async () => {
    const repo = new MockAuditRepository();
    await repo.create(makeEvent());
    const result = await repo.listByWorkspace({
      workspaceId: "ws-1",
      limit: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.action).toBe("TASK.CREATED");
  });

  it("returns events newest first", async () => {
    const repo = new MockAuditRepository();
    await repo.create(makeEvent({ id: "e1", createdAt: "2026-06-23T10:00:00.000Z" }));
    await repo.create(makeEvent({ id: "e2", createdAt: "2026-06-23T12:00:00.000Z" }));
    await repo.create(makeEvent({ id: "e3", createdAt: "2026-06-23T11:00:00.000Z" }));
    const result = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(result.items.map((e) => e.id)).toEqual(["e2", "e3", "e1"]);
  });

  it("filters events by workspaceId", async () => {
    const repo = new MockAuditRepository();
    await repo.create(makeEvent({ workspaceId: "ws-1", id: "e1" }));
    await repo.create(makeEvent({ workspaceId: "ws-2", id: "e2" }));
    const result = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe("e1");
  });

  it("paginates with nextToken", async () => {
    const repo = new MockAuditRepository();
    for (let i = 0; i < 5; i++) {
      await repo.create(
        makeEvent({ id: `e${i}`, createdAt: `2026-06-23T${10 + i}:00:00.000Z` }),
      );
    }
    const page1 = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextToken).toBe("2");

    const page2 = await repo.listByWorkspace({
      workspaceId: "ws-1",
      limit: 2,
      nextToken: page1.nextToken,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextToken).toBe("4");

    const page3 = await repo.listByWorkspace({
      workspaceId: "ws-1",
      limit: 2,
      nextToken: page2.nextToken,
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.nextToken).toBeUndefined();
  });

  it("returns empty list for workspace with no events", async () => {
    const repo = new MockAuditRepository();
    const result = await repo.listByWorkspace({ workspaceId: "ws-999", limit: 10 });
    expect(result.items).toHaveLength(0);
    expect(result.nextToken).toBeUndefined();
  });

  it("deep clones events on create", async () => {
    const repo = new MockAuditRepository();
    const event = makeEvent();
    await repo.create(event);
    event.id = "mutated";
    const result = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(result.items[0]!.id).toBe("evt-1");
  });

  it("deep clones events on list", async () => {
    const repo = new MockAuditRepository();
    await repo.create(makeEvent());
    const result = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    result.items[0]!.id = "mutated";
    const result2 = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(result2.items[0]!.id).toBe("evt-1");
  });

  it("handles empty repository gracefully", async () => {
    const repo = new MockAuditRepository();
    const result = await repo.listByWorkspace({ workspaceId: "ws-1", limit: 10 });
    expect(result.items).toEqual([]);
  });
});
