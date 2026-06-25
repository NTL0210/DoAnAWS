import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { AuditEvent } from "./audit.types.js";
import type { AuditRepository } from "./audit.repository.js";

export class MockAuditRepository implements AuditRepository {
  private readonly events: AuditEvent[] = [];

  async create(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }

  async listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<AuditEvent>> {
    const offset = params.nextToken ? Number(params.nextToken) : 0;
    const filtered = this.events
      .filter((e) => e.workspaceId === params.workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = filtered.slice(offset, offset + params.limit);
    const nextOffset = offset + params.limit;
    return {
      items: page.map((e) => structuredClone(e)),
      nextToken: nextOffset < filtered.length ? String(nextOffset) : undefined,
    };
  }
}
