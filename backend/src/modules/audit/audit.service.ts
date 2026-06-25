import { randomUUID } from "node:crypto";
import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { AuditAction, AuditEvent } from "./audit.types.js";
import type { AuditRepository } from "./audit.repository.js";

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async record(params: {
    workspaceId: string;
    action: AuditAction;
    performedBy: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown> | undefined;
  }): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: randomUUID(),
      workspaceId: params.workspaceId,
      action: params.action,
      performedBy: params.performedBy,
      targetType: params.targetType,
      targetId: params.targetId,
      details: params.details,
      createdAt: new Date().toISOString(),
    };
    await this.repository.create(event);
    return event;
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<AuditEvent>> {
    return this.repository.listByWorkspace(params);
  }
}
