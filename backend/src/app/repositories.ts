import { DynamoWorkspaceRepository as DynamoAuthWorkspaceRepository } from "../modules/auth/workspace.repository.dynamodb.js";
import type { WorkspaceRepository as AuthWorkspaceRepository } from "../modules/auth/workspace.repository.js";
import { DynamoWorkspaceRepository as DynamoWorkspaceCrudRepository } from "../modules/workspaces/workspace.repository.dynamodb.js";
import type { WorkspaceRepository as WorkspaceCrudRepository } from "../modules/workspaces/workspace.repository.js";
import type { AuditRepository } from "../modules/audit/audit.repository.js";
import { DynamoAuditRepository } from "../modules/audit/audit.repository.dynamodb.js";
import { DynamoMeetingRepository } from "../modules/meetings/meeting.repository.dynamodb.js";
import type { MeetingRepository } from "../modules/meetings/meeting.repository.js";
import { DynamoTaskRepository } from "../modules/tasks/task.repository.dynamodb.js";
import type { TaskRepository } from "../modules/tasks/task.repository.js";
import { DynamoUserRepository } from "../modules/users/user.repository.dynamodb.js";
import type { UserRepository } from "../modules/users/user.repository.js";
import { DynamoVoiceRecordingRepository } from "../modules/voice-recordings/voice-recording.repository.dynamodb.js";
import type { VoiceRecordingRepository } from "../modules/voice-recordings/voice-recording.repository.js";

export interface Repositories {
  meetings: MeetingRepository;
  tasks: TaskRepository;
  users: UserRepository;
  workspaces: AuthWorkspaceRepository;
  workspaceCrud: WorkspaceCrudRepository;
  audit: AuditRepository;
  voiceRecordings: VoiceRecordingRepository;
}

export function buildRepositories(): Repositories {
  return {
    meetings: new DynamoMeetingRepository(),
    tasks: new DynamoTaskRepository(),
    users: new DynamoUserRepository(),
    workspaces: new DynamoAuthWorkspaceRepository(),
    workspaceCrud: new DynamoWorkspaceCrudRepository(),
    audit: new DynamoAuditRepository(),
    voiceRecordings: new DynamoVoiceRecordingRepository(),
  };
}
