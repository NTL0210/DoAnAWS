import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { UserService } from "../users/user.service.js";
import type { WorkspaceRepository } from "./workspace.repository.js";
import type {
  Workspace,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  WorkspaceMember,
} from "./workspace.types.js";
import { createWorkspaceAttachmentUploadUrl } from "./workspace.upload.js";

type MemberProfile = {
  name: string | null;
  email: string | null;
  avatar: string | null;
};

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly userService?: UserService,
  ) {}

  async list(userId?: string): Promise<Workspace[]> {
    if (userId) {
      const workspaces = await this.repository.findByUserId(userId);
      return Promise.all(workspaces.map((workspace) => this.hydrateWorkspaceMembers(workspace)));
    }
    // If no userId filter, we'd need a scan — not implemented for now.
    return [];
  }

  async get(id: string): Promise<Workspace> {
    const ws = await this.repository.findById(id);
    if (!ws) throw new NotFoundError("Workspace not found");
    return this.hydrateWorkspaceMembers(ws);
  }

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    const now = new Date().toISOString();
    const slug = this.generateSlug(input.name);
    const id = randomUUID();
    const ownerProfile = await this.getMemberProfile(input.ownerId);

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
          name: ownerProfile.name,
          email: ownerProfile.email,
          avatar: ownerProfile.avatar,
        },
      ],
      channels: input.channels ?? defaultWorkspaceChannels(id, now),
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
    return this.hydrateWorkspaceMembers(workspace);
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

  async createAttachmentUpload(id: string, userId: string, input: {
    fileName: string;
    contentType: string;
  }): Promise<Awaited<ReturnType<typeof createWorkspaceAttachmentUploadUrl>>> {
    await this.get(id);
    return createWorkspaceAttachmentUploadUrl({
      workspaceId: id,
      userId,
      fileName: input.fileName,
      contentType: input.contentType,
    });
  }

  async addMember(
    id: string,
    userId: string,
    role: WorkspaceMember["role"] = "EMPLOYEE",
    profile: Partial<Pick<WorkspaceMember, "name" | "email" | "avatar">> = {},
  ): Promise<WorkspaceMember> {
    const ws = await this.get(id);

    const existing = ws.members.find((m) => m.userId === userId);
    if (existing) return this.hydrateMember(existing);

    const now = new Date().toISOString();
    const storedProfile = await this.getMemberProfile(userId);
    const member: WorkspaceMember = {
      userId,
      role,
      joinedAt: now,
      nickname: null,
      name: profile.name ?? storedProfile.name,
      email: profile.email ?? storedProfile.email,
      avatar: profile.avatar ?? storedProfile.avatar,
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

  private async hydrateWorkspaceMembers(workspace: Workspace): Promise<Workspace> {
    const members = await Promise.all((workspace.members ?? []).map((member) => this.hydrateMember(member)));
    return { ...workspace, members };
  }

  private async hydrateMember(member: WorkspaceMember): Promise<WorkspaceMember> {
    const profile = await this.getMemberProfile(member.userId);
    const name = this.isUsableMemberName(member.name, member.userId) ? member.name! : profile.name;
    return {
      ...member,
      name,
      email: member.email || profile.email,
      avatar: profile.avatar ?? member.avatar ?? null,
    };
  }

  private isUsableMemberName(name: string | null | undefined, userId: string): boolean {
    const value = String(name || "").trim();
    if (!value) return false;
    if (value === userId) return false;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return false;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4,}$/i.test(value)) return false;
    return true;
  }

  private async getMemberProfile(userId: string): Promise<MemberProfile> {
    if (!this.userService) return { name: null, email: null, avatar: null };
    try {
      const user = await this.userService.getById(userId);
      return {
        name: user.name || null,
        email: user.email || null,
        avatar: user.avatar || null,
      };
    } catch {
      return { name: null, email: null, avatar: null };
    }
  }
}

function defaultWorkspaceChannels(workspaceId: string, now: string): Workspace["channels"] {
  return [
    {
      id: `${workspaceId}-ch-general`,
      workspaceId,
      name: "general",
      type: "text",
      description: "General discussion",
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}-vc-general`,
      workspaceId,
      name: "General Voice",
      type: "voice",
      scope: "WORKSPACE",
      teamId: null,
      allowedTeamIds: [],
      allowedUserIds: [],
      deniedUserIds: [],
      isDefault: false,
      isLocked: false,
      allowRecording: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
