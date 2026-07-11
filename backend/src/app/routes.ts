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
import { VoiceRecordingController } from "../modules/voice-recordings/voice-recording.controller.js";
import { buildVoiceRecordingRouter } from "../modules/voice-recordings/voice-recording.router.js";
import { VoiceRecordingService } from "../modules/voice-recordings/voice-recording.service.js";
import { IceServerService } from "../modules/voice/ice-server.service.js";
import { VoiceController } from "../modules/voice/voice.controller.js";
import { buildVoiceRouter } from "../modules/voice/voice.router.js";
import { WorkspaceController } from "../modules/workspaces/workspace.controller.js";
import { buildWorkspaceRouter } from "../modules/workspaces/workspace.router.js";
import { WorkspaceService } from "../modules/workspaces/workspace.service.js";
import type { Repositories } from "./repositories.js";

/** Middleware factory pre-bound to the workspace repository. */
export type GuardFn = (...roles: WorkspaceRole[]) => RequestHandler;

export function buildApiRouter(repositories: Repositories): Router {
  const api = Router();

  // Partial-apply the workspace repo so callers only supply the required roles.
  const guard: GuardFn = (...roles) =>
    requireWorkspaceRole(repositories.workspaces, ...roles);

  const userService = new UserService(repositories.users);
  const workspaceService = new WorkspaceService(repositories.workspaceCrud, userService);

  // ── Meetings ──────────────────────────────────────────
  const meetingService = new MeetingService(repositories.meetings);
  const meetingController = new MeetingController(meetingService, userService, workspaceService);
  api.use("/meetings", buildMeetingRouter(meetingController, guard));

  const voiceRecordingService = new VoiceRecordingService(
    repositories.voiceRecordings,
    meetingService,
    repositories.workspaces,
  );
  const voiceRecordingController = new VoiceRecordingController(voiceRecordingService);
  api.use("/voice-recordings", buildVoiceRecordingRouter(voiceRecordingController, guard));

  const voiceController = new VoiceController(new IceServerService());
  api.use("/voice", buildVoiceRouter(voiceController));

  // ── Tasks ─────────────────────────────────────────────
  const taskService = new TaskService(repositories.tasks);
  const taskController = new TaskController(taskService);
  api.use("/tasks", buildTaskRouter(taskController, guard));

  // ── Users ─────────────────────────────────────────────
  const userController = new UserController(userService);
  api.use("/users", buildUserRouter(userController, guard));

  // ── Workspaces ────────────────────────────────────────
  const workspaceController = new WorkspaceController(workspaceService);
  api.use("/workspaces", buildWorkspaceRouter(workspaceController, guard));

  return api;
}
