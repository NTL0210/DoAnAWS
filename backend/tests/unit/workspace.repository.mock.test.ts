import { describe, expect, it } from "vitest";
import { MockWorkspaceRepository } from "../../src/modules/auth/workspace.repository.mock.js";

describe("MockWorkspaceRepository", () => {
  it("returns OWNER role for seed member user-1 in ws-1", async () => {
    const repo = new MockWorkspaceRepository();
    const role = await repo.getMemberRole("ws-1", "user-1");
    expect(role).toBe("OWNER");
  });

  it("returns ADMIN role for seed member user-2 in ws-1", async () => {
    const repo = new MockWorkspaceRepository();
    const role = await repo.getMemberRole("ws-1", "user-2");
    expect(role).toBe("ADMIN");
  });

  it("returns MEMBER role for seed member user-3 in ws-1", async () => {
    const repo = new MockWorkspaceRepository();
    const role = await repo.getMemberRole("ws-1", "user-3");
    expect(role).toBe("MEMBER");
  });

  it("returns null for non-member user", async () => {
    const repo = new MockWorkspaceRepository([]);
    const role = await repo.getMemberRole("ws-1", "unknown-user");
    expect(role).toBeNull();
  });

  it("returns null for workspace with no members", async () => {
    const repo = new MockWorkspaceRepository([]);
    const role = await repo.getMemberRole("ws-2", "user-1");
    expect(role).toBeNull();
  });

  it("lists all members of a workspace", async () => {
    const repo = new MockWorkspaceRepository();
    const members = await repo.getMembers("ws-1");
    expect(members).toHaveLength(4);
    expect(members.map((m) => m.userId)).toEqual([
      "user-1",
      "user-2",
      "user-3",
      "user-4",
    ]);
  });

  it("does not include members from other workspaces", async () => {
    const repo = new MockWorkspaceRepository();
    const members = await repo.getMembers("ws-999");
    expect(members).toHaveLength(0);
  });

  it("setMemberRole updates an existing member's role", async () => {
    const repo = new MockWorkspaceRepository();
    await repo.setMemberRole("ws-1", "user-3", "ADMIN");
    const role = await repo.getMemberRole("ws-1", "user-3");
    expect(role).toBe("ADMIN");
  });

  it("setMemberRole adds a new member if not exists", async () => {
    const repo = new MockWorkspaceRepository([]);
    await repo.setMemberRole("ws-1", "new-user", "MEMBER");
    const role = await repo.getMemberRole("ws-1", "new-user");
    expect(role).toBe("MEMBER");
  });

  it("removeMember deletes the membership", async () => {
    const repo = new MockWorkspaceRepository();
    await repo.removeMember("ws-1", "user-1");
    const role = await repo.getMemberRole("ws-1", "user-1");
    expect(role).toBeNull();
  });

  it("removeMember is idempotent for non-existent members", async () => {
    const repo = new MockWorkspaceRepository([]);
    await expect(
      repo.removeMember("ws-1", "ghost"),
    ).resolves.toBeUndefined();
  });

  it("deep clones members to prevent mutation leaks", async () => {
    const repo = new MockWorkspaceRepository();
    const members = await repo.getMembers("ws-1");
    members[0]!.role = "MEMBER";
    const role = await repo.getMemberRole("ws-1", "user-1");
    expect(role).toBe("OWNER");
  });

  it("supports empty initial members list", async () => {
    const repo = new MockWorkspaceRepository([]);
    await expect(repo.getMembers("ws-1")).resolves.toHaveLength(0);
  });
});
