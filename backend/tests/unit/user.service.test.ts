import { describe, expect, it } from "vitest";
import { UserService } from "../../src/modules/users/user.service.js";
import type { UserRepository } from "../../src/modules/users/user.repository.js";
import type { User } from "../../src/modules/users/user.types.js";

class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  constructor(initial: User[] = []) {
    for (const user of initial) this.users.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    return Array.from(this.users.values()).find((user) => user.email === normalized) ?? null;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async create(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async update(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async delete_(id: string): Promise<void> {
    this.users.delete(id);
  }
}

function user(overrides: Partial<User>): User {
  return {
    id: "user-1",
    name: "user-1",
    email: "user-1@user.local",
    avatar: null,
    phone: "",
    avatarHistory: [],
    role: "EMPLOYEE",
    departmentId: null,
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("UserService", () => {
  it("syncs an existing fallback email from Cognito auth claims", async () => {
    const repo = new InMemoryUserRepository([user({})]);
    const service = new UserService(repo);

    const result = await service.getOrCreateFromAuth({
      userId: "user-1",
      email: "Real.User@Example.com",
      name: "Real User",
      systemRole: "EMPLOYEE",
    });

    expect(result.email).toBe("real.user@example.com");
    expect(result.name).toBe("Real User");
    expect(result.version).toBe(2);
    expect(repo.users.get("user-1")?.email).toBe("real.user@example.com");
  });

  it("keeps a custom display name while syncing the Cognito email", async () => {
    const repo = new InMemoryUserRepository([
      user({ name: "Custom Name", email: "old@example.com" }),
    ]);
    const service = new UserService(repo);

    const result = await service.getOrCreateFromAuth({
      userId: "user-1",
      email: "new@example.com",
      name: "Cognito Name",
      systemRole: "EMPLOYEE",
    });

    expect(result.email).toBe("new@example.com");
    expect(result.name).toBe("Custom Name");
  });
});
