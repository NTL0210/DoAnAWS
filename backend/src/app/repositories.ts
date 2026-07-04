import { DynamoWorkspaceRepository as DynamoAuthWorkspaceRepository } from "../modules/auth/workspace.repository.dynamodb.js";
import type { WorkspaceRepository as AuthWorkspaceRepository } from "../modules/auth/workspace.repository.js";
import { DynamoWorkspaceRepository as DynamoWorkspaceCrudRepository } from "../modules/workspaces/workspace.repository.dynamodb.js";
import type { WorkspaceRepository as WorkspaceCrudRepository } from "../modules/workspaces/workspace.repository.js";
import type { AuditRepository } from "../modules/audit/audit.repository.js";
import type { AuditEvent } from "../modules/audit/audit.types.js";
import type { PaginatedResult } from "../shared/types/pagination.js";
import { DynamoMeetingRepository } from "../modules/meetings/meeting.repository.dynamodb.js";
import type { MeetingRepository } from "../modules/meetings/meeting.repository.js";
import { DynamoTaskRepository } from "../modules/tasks/task.repository.dynamodb.js";
import type { TaskRepository } from "../modules/tasks/task.repository.js";
import { DynamoUserRepository } from "../modules/users/user.repository.dynamodb.js";
import type { UserRepository } from "../modules/users/user.repository.js";

export interface Repositories {
  meetings: MeetingRepository;
  tasks: TaskRepository;
  users: UserRepository;
  workspaces: AuthWorkspaceRepository;
  workspaceCrud: WorkspaceCrudRepository;
  audit: AuditRepository;
}

/**
 * Minimal in-memory audit sink — replaces deleted MockAuditRepository.
 * Audit can be upgraded to a DynamoDB-backed implementation later.
 */
class InMemoryAuditRepository implements AuditRepository {
  private entries: AuditEvent[] = [];
  async create(event: AuditEvent): Promise<void> {
    this.entries.push(event);
  }
  async listByWorkspace(_params: {
    workspaceId: string;
    limit: number;
    nextToken?: string;
  }): Promise<PaginatedResult<AuditEvent>> {
    return { items: this.entries, nextToken: undefined };
  }
}

export function buildRepositories(): Repositories {
  return {
    meetings: new DynamoMeetingRepository(),
    tasks: new DynamoTaskRepository(),
    users: new DynamoUserRepository(),
    workspaces: new DynamoAuthWorkspaceRepository(),
    workspaceCrud: new DynamoWorkspaceCrudRepository(),
    audit: new InMemoryAuditRepository(),
  };
}
