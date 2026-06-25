import type { PaginatedResult } from "../../shared/types/pagination.js";
import type { AuditEvent } from "./audit.types.js";

export interface AuditRepository {
  create(event: AuditEvent): Promise<void>;
  listByWorkspace(params: {
    workspaceId: string;
    limit: number;
    nextToken?: string | undefined;
  }): Promise<PaginatedResult<AuditEvent>>;
}
