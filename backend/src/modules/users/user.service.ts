import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../shared/errors/app-error.js";
import type { UserRepository } from "./user.repository.js";
import type { CreateUserInput, UpdateUserInput, User } from "./user.types.js";

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getById(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return this.stripPassword(user);
  }

  async getByEmail(email: string): Promise<User | null> {
    const user = await this.repository.findByEmail(email);
    return user ? this.stripPassword(user) : null;
  }

  async getAll(): Promise<User[]> {
    const users = await this.repository.findAll();
    return users.map((u) => this.stripPassword(u));
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: "user-" + randomUUID().slice(0, 8),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      avatar: input.avatar ?? null,
      phone: "",
      avatarHistory: [],
      role: input.role ?? "EMPLOYEE",
      departmentId: input.departmentId ?? null,
      password: input.password,
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    await this.repository.create(user);
    return this.stripPassword(user);
  }

  async update(input: {
    id: string;
    patch: UpdateUserInput;
  }): Promise<User> {
    const current = await this.repository.findById(input.id);
    if (!current) throw new NotFoundError("User not found");

    const updated: User = {
      ...current,
      name: input.patch.name ?? current.name,
      avatar: input.patch.avatar === undefined ? current.avatar : input.patch.avatar,
      phone: input.patch.phone ?? current.phone,
      avatarHistory: input.patch.avatarHistory ?? current.avatarHistory,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };
    await this.repository.update(updated, input.patch.expectedVersion);
    return this.stripPassword(updated);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete_(id);
  }

  private stripPassword(user: User): User {
    const { password: _, ...rest } = user;
    return rest as User;
  }
}
