import { describe, expect, it } from "vitest";
import { TaskService } from "../../src/modules/tasks/task.service.js";
import { InMemoryTaskRepository } from "../support/in-memory-repositories.js";

describe("TaskService", () => {
  it("marks progress complete when status becomes COMPLETED", async () => {
    const repo = new InMemoryTaskRepository([]);
    const service = new TaskService(repo);
    const task = await service.create({ workspaceId: "ws-1", title: "Ship API" });

    const updated = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "COMPLETED", expectedVersion: 1 }
    });

    expect(updated.progress).toBe(100);
    expect(updated.version).toBe(2);
  });
});
