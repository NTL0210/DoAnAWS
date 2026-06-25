import type { WorkspaceMembership, WorkspaceRole } from "./auth.types.js";
import type { WorkspaceRepository } from "./workspace.repository.js";

const seedMembers: WorkspaceMembership[] = [
  { workspaceId: "ws-1", userId: "user-1", role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
  { workspaceId: "ws-1", userId: "user-2", role: "ADMIN", joinedAt: "2026-01-15T00:00:00.000Z" },
  { workspaceId: "ws-1", userId: "user-3", role: "MEMBER", joinedAt: "2026-02-01T00:00:00.000Z" },
  { workspaceId: "ws-1", userId: "user-4", role: "MEMBER", joinedAt: "2026-02-15T00:00:00.000Z" },
];

export class MockWorkspaceRepository implements WorkspaceRepository {
  private members: WorkspaceMembership[];

  constructor(initial: WorkspaceMembership[] = seedMembers) {
    this.members = structuredClone(initial);
  }

  async getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const member = this.members.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId,
    );
    return member ? member.role : null;
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMembership[]> {
    return this.members
      .filter((m) => m.workspaceId === workspaceId)
      .map((m) => structuredClone(m));
  }

  async setMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    const existing = this.members.findIndex(
      (m) => m.workspaceId === workspaceId && m.userId === userId,
    );
    if (existing >= 0) {
      this.members[existing] = { ...this.members[existing]!, role };
    } else {
      this.members.push({
        workspaceId,
        userId,
        role,
        joinedAt: new Date().toISOString(),
      });
    }
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    this.members = this.members.filter(
      (m) => !(m.workspaceId === workspaceId && m.userId === userId),
    );
  }
}
