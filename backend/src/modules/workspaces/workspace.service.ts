import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { WorkspaceRepository } from "./workspace.repository.js";
import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceMember,
} from "./workspace.types.js";

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  async list(userId?: string): Promise<Workspace[]> {
    if (userId) {
      return this.repository.findByUserId(userId);
    }
    // If no userId filter, we'd need a scan — not implemented for now.
    return [];
  }

  async get(id: string): Promise<Workspace> {
    const ws = await this.repository.findById(id);
    if (!ws) throw new NotFoundError("Workspace not found");
    return ws;
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const now = new Date().toISOString();
    const slug = this.generateSlug(input.name);
    const id = randomUUID();

    const workspace: Workspace = {
      id,
      name: input.name.trim(),
      description: input.description ?? "",
      iconColor: input.iconColor ?? "blue",
      workspaceType: input.workspaceType ?? "blank",
      visibility: input.visibility ?? "private",
      slug,
      ownerId: input.ownerId,
      memberIds: [input.ownerId],
      members: input.members ?? [
        {
          userId: input.ownerId,
          role: "OWNER",
          joinedAt: now,
          nickname: null,
        },
      ],
      channels: input.channels ?? [],
      teams: input.teams ?? [],
      tasks: [],
      meetings: [],
      messages: {},
      notifications: [],
      invitations: [],
      voiceRecords: [],
      customRoles: [],
      features: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.create(workspace);
    return workspace;
  }

  async update(id: string, patch: UpdateWorkspaceInput): Promise<Workspace> {
    const current = await this.get(id);

    const updated: Workspace = {
      ...current,
      name: patch.name?.trim() ?? current.name,
      description: patch.description ?? current.description,
      iconColor: patch.iconColor ?? current.iconColor,
      visibility: patch.visibility ?? current.visibility,
      channels: patch.channels ?? current.channels,
      teams: patch.teams ?? current.teams,
      members: patch.members ?? current.members,
      messages: patch.messages ?? current.messages,
      voiceRecords: patch.voiceRecords ?? current.voiceRecords,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.update(updated, patch.expectedVersion);
    return updated;
  }

  async delete_(id: string): Promise<void> {
    const ws = await this.repository.findById(id);
    if (!ws) throw new NotFoundError("Workspace not found");
    await this.repository.delete_(id);
  }

  async getMembers(id: string): Promise<WorkspaceMember[]> {
    const ws = await this.get(id);
    return ws.members ?? [];
  }

  async addMember(
    id: string,
    userId: string,
    role: WorkspaceMember["role"] = "EMPLOYEE",
  ): Promise<WorkspaceMember> {
    const ws = await this.get(id);

    const existing = ws.members.find((m) => m.userId === userId);
    if (existing) return existing;

    const now = new Date().toISOString();
    const member: WorkspaceMember = {
      userId,
      role,
      joinedAt: now,
      nickname: null,
    };

    const updated: Workspace = {
      ...ws,
      memberIds: [...ws.memberIds, userId],
      members: [...ws.members, member],
      version: ws.version + 1,
      updatedAt: now,
    };

    await this.repository.update(updated, ws.version);
    return member;
  }

  async removeMember(id: string, userId: string): Promise<void> {
    const ws = await this.get(id);

    const updated: Workspace = {
      ...ws,
      memberIds: ws.memberIds.filter((mid) => mid !== userId),
      members: ws.members.filter((m) => m.userId !== userId),
      version: ws.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.repository.update(updated, ws.version);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "workspace";
  }
}
