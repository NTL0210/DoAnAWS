import type { Workspace, CreateWorkspaceInput, UpdateWorkspaceInput } from "./workspace.types.js";

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>;
  findByUserId(userId: string): Promise<Workspace[]>;
  create(workspace: Workspace): Promise<void>;
  update(workspace: Workspace, expectedVersion: number): Promise<void>;
  delete_(id: string): Promise<void>;
}
