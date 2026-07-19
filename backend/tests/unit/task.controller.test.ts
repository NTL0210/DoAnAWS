import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../../src/shared/errors/app-error.js";
import { TaskController } from "../../src/modules/tasks/task.controller.js";
import { TaskService } from "../../src/modules/tasks/task.service.js";
import { InMemoryTaskRepository } from "../support/in-memory-repositories.js";

function mockResponse(workspaceRole: string, workspacePermissions?: string[]) {
  const state: { statusCode?: number; body?: unknown } = {};
  const response = {
    locals: { workspaceId: "ws-1", workspaceRole, workspacePermissions },
    status: vi.fn((statusCode: number) => {
      state.statusCode = statusCode;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
      return response;
    }),
    send: vi.fn(() => response),
  };
  return { response, state };
}

function mockRequest(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: { userId: "employee-1" },
    ...overrides,
  };
}

describe("TaskController authorization", () => {
  it("only lists tasks assigned to an employee", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const assigned = await service.create({ workspaceId: "ws-1", title: "Assigned", assigneeId: "employee-1" });
    await service.create({ workspaceId: "ws-1", title: "Unassigned" });
    const controller = new TaskController(service);
    const { response, state } = mockResponse("EMPLOYEE");
    const next = vi.fn();

    await controller.list(mockRequest() as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(200);
    expect((state.body as { items: Array<{ id: string }> }).items.map((task) => task.id)).toEqual([assigned.id]);
  });

  it("lets the assignee start a task without a deadline", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const task = await service.create({ workspaceId: "ws-1", title: "No deadline", assigneeId: "employee-1" });
    const controller = new TaskController(service);
    const { response, state } = mockResponse("EMPLOYEE");
    const next = vi.fn();

    await controller.update(mockRequest({
      params: { id: task.id },
      body: { status: "IN_PROGRESS", expectedVersion: 1 },
    }) as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(200);
    expect((state.body as { status: string }).status).toBe("IN_PROGRESS");
  });

  it("rejects an employee updating somebody else's task", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const task = await service.create({ workspaceId: "ws-1", title: "Private task", assigneeId: "employee-2" });
    const controller = new TaskController(service);
    const { response } = mockResponse("EMPLOYEE");
    const next = vi.fn();

    await controller.update(mockRequest({
      params: { id: task.id },
      body: { status: "IN_PROGRESS", expectedVersion: 1 },
    }) as never, response as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("lets a manager add a missing deadline without changing task status", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const task = await service.create({ workspaceId: "ws-1", title: "Needs deadline", assigneeId: "employee-1" });
    const controller = new TaskController(service);
    const { response, state } = mockResponse("MANAGER");
    const next = vi.fn();

    await controller.update(mockRequest({
      params: { id: task.id },
      body: { deadline: "2026-07-25", expectedVersion: 1 },
      user: { userId: "manager-1" },
    }) as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(200);
    expect((state.body as { deadline: string }).deadline).toBe("2026-07-25");
    expect((state.body as { status: string }).status).toBe("PENDING");
  });

  it("lets an owner approve a review task assigned to themselves", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const task = await service.create({ workspaceId: "ws-1", title: "Owner task", assigneeId: "owner-1" });
    const inProgress = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "IN_PROGRESS", expectedVersion: task.version },
    });
    const inReview = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "REVIEW", expectedVersion: inProgress.version },
    });
    const controller = new TaskController(service);
    const { response, state } = mockResponse("OWNER");
    const next = vi.fn();

    await controller.update(mockRequest({
      params: { id: task.id },
      body: { status: "COMPLETED", expectedVersion: inReview.version },
      user: { userId: "owner-1" },
    }) as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(200);
    expect((state.body as { status: string }).status).toBe("COMPLETED");
    expect((state.body as { progress: number }).progress).toBe(100);
  });

  it("does not let an employee approve their own review task", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const task = await service.create({ workspaceId: "ws-1", title: "Employee task", assigneeId: "employee-1" });
    const inProgress = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "IN_PROGRESS", expectedVersion: task.version },
    });
    const inReview = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "REVIEW", expectedVersion: inProgress.version },
    });
    const controller = new TaskController(service);
    const { response } = mockResponse("EMPLOYEE");
    const next = vi.fn();

    await controller.update(mockRequest({
      params: { id: task.id },
      body: { status: "COMPLETED", expectedVersion: inReview.version },
    }) as never, response as never, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("lets a custom reviewer approve a task in review", async () => {
    const service = new TaskService(new InMemoryTaskRepository());
    const task = await service.create({ workspaceId: "ws-1", title: "Review me", assigneeId: "employee-1" });
    const inProgress = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "IN_PROGRESS", expectedVersion: task.version },
    });
    const inReview = await service.update({
      workspaceId: "ws-1",
      taskId: task.id,
      patch: { status: "REVIEW", expectedVersion: inProgress.version },
    });
    const controller = new TaskController(service);
    const { response, state } = mockResponse("MEMBER", ["tasks.view", "tasks.approve"]);
    const next = vi.fn();

    await controller.update(mockRequest({
      params: { id: task.id },
      body: { status: "COMPLETED", expectedVersion: inReview.version },
      user: { userId: "reviewer-1" },
    }) as never, response as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(200);
    expect((state.body as { status: string }).status).toBe("COMPLETED");
  });
});
