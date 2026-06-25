import type { RequestHandler } from "express";
import { Router } from "express";
import { requireWorkspaceRole } from "../modules/auth/auth.middleware.js";
import type { WorkspaceRole } from "../modules/auth/auth.types.js";
import { MeetingController } from "../modules/meetings/meeting.controller.js";
import { buildMeetingRouter } from "../modules/meetings/meeting.router.js";
import { MeetingService } from "../modules/meetings/meeting.service.js";
import { TaskController } from "../modules/tasks/task.controller.js";
import { buildTaskRouter } from "../modules/tasks/task.router.js";
import { TaskService } from "../modules/tasks/task.service.js";
import { UserController } from "../modules/users/user.controller.js";
import { buildUserRouter } from "../modules/users/user.router.js";
import { UserService } from "../modules/users/user.service.js";
import type { Repositories } from "./repositories.js";

/** Middleware factory pre-bound to the workspace repository. */
export type GuardFn = (...roles: WorkspaceRole[]) => RequestHandler;

export function buildApiRouter(repositories: Repositories): Router {
  const api = Router();

  // Partial-apply the workspace repo so callers only supply the required roles.
  const guard: GuardFn = (...roles) =>
    requireWorkspaceRole(repositories.workspaces, ...roles);

  // ── Meetings ──────────────────────────────────────────
  const meetingService = new MeetingService(repositories.meetings);
  const meetingController = new MeetingController(meetingService);
  api.use("/meetings", buildMeetingRouter(meetingController, guard));

  // ── Tasks ─────────────────────────────────────────────
  const taskService = new TaskService(repositories.tasks);
  const taskController = new TaskController(taskService);
  api.use("/tasks", buildTaskRouter(taskController, guard));

  // ── Users ─────────────────────────────────────────────
  const userService = new UserService(repositories.users);
  const userController = new UserController(userService);
  api.use("/users", buildUserRouter(userController, guard));

  return api;
}
