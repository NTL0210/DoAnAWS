import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "../../src/modules/workspaces/workspace.service.js";
import type { WorkspaceRepository } from "../../src/modules/workspaces/workspace.repository.js";
import type { Workspace } from "../../src/modules/workspaces/workspace.types.js";

describe("WorkspaceService", () => {
  it("removes duplicate and unknown team members when a workspace is updated", async () => {
    const workspace = createWorkspace();
    const update = vi.fn(async () => undefined);
    const repository: WorkspaceRepository = {
      findById: vi.fn(async () => workspace),
      findByUserId: vi.fn(async () => [workspace]),
      create: vi.fn(async () => undefined),
      update,
      delete_: vi.fn(async () => undefined),
    };
    const service = new WorkspaceService(repository);

    const saved = await service.update(workspace.id, {
      expectedVersion: 1,
      teams: [{
        ...workspace.teams[0]!,
        memberIds: ["owner-1", "employee-1", "employee-1", "removed-user"],
      }],
    });

    expect(saved.teams[0]?.memberIds).toEqual(["owner-1", "employee-1"]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ teams: saved.teams }), 1);
  });
});

function createWorkspace(): Workspace {
  return {
    id: "workspace-1",
    name: "FCAJ",
    description: "",
    iconColor: "blue",
    workspaceType: "blank",
    visibility: "private",
    slug: "fcaj",
    ownerId: "owner-1",
    memberIds: ["owner-1", "employee-1"],
    members: [
      { userId: "owner-1", role: "OWNER", joinedAt: "2026-07-18", nickname: null },
      { userId: "employee-1", role: "EMPLOYEE", joinedAt: "2026-07-18", nickname: null },
    ],
    channels: [],
    teams: [{ id: "team-1", name: "BE", managerId: "owner-1", memberIds: ["owner-1", "employee-1"] }],
    tasks: [],
    meetings: [],
    messages: {},
    notifications: [],
    invitations: [],
    voiceRecords: [],
    customRoles: [],
    features: [],
    version: 1,
    createdAt: "2026-07-18",
    updatedAt: "2026-07-18",
  };
}
