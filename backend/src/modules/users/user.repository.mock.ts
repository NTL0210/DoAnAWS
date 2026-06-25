import { ConflictError, NotFoundError } from "../../shared/errors/app-error.js";
import type { UserRepository } from "./user.repository.js";
import type { User } from "./user.types.js";

const seed: User[] = [
  {
    id: "user-1",
    name: "Alex Admin",
    email: "admin@company.com",
    avatar: "https://ui-avatars.com/api/?name=Alex+Admin&background=5865F2&color=fff&size=128&bold=true",
    phone: "",
    avatarHistory: [],
    role: "ADMIN",
    departmentId: null,
    password: "123456",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "user-2",
    name: "Megan Manager",
    email: "manager@company.com",
    avatar: "https://ui-avatars.com/api/?name=Megan+Manager&background=ED4245&color=fff&size=128&bold=true",
    phone: "",
    avatarHistory: [],
    role: "MANAGER",
    departmentId: "dept-1",
    password: "123456",
    version: 1,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z"
  },
  {
    id: "user-3",
    name: "Emily Employee",
    email: "employee@company.com",
    avatar: "https://ui-avatars.com/api/?name=Emily+Employee&background=57F287&color=fff&size=128&bold=true",
    phone: "",
    avatarHistory: [],
    role: "EMPLOYEE",
    departmentId: "dept-1",
    password: "123456",
    version: 1,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z"
  },
  {
    id: "user-4",
    name: "John Doe",
    email: "john@company.com",
    avatar: "https://ui-avatars.com/api/?name=John+Doe&background=FEE75C&color=fff&size=128&bold=true",
    phone: "+84 123 456 789",
    avatarHistory: [],
    role: "EMPLOYEE",
    departmentId: "dept-1",
    password: "123456",
    version: 1,
    createdAt: "2026-02-15T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z"
  }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MockUserRepository implements UserRepository {
  private readonly items = new Map<string, User>();

  constructor(initial: User[] = seed) {
    for (const user of initial) {
      this.items.set(user.id, clone(user));
    }
  }

  async findById(id: string): Promise<User | null> {
    const user = this.items.get(id);
    return user ? clone(user) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = [...this.items.values()].find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    return user ? clone(user) : null;
  }

  async findAll(): Promise<User[]> {
    return [...this.items.values()].map(clone);
  }

  async create(user: User): Promise<void> {
    if (this.items.has(user.id)) {
      throw new ConflictError("User already exists");
    }
    this.items.set(user.id, clone(user));
  }

  async update(user: User, expectedVersion: number): Promise<void> {
    const current = this.items.get(user.id);
    if (!current) {
      throw new NotFoundError("User not found");
    }
    if (current.version !== expectedVersion) {
      throw new ConflictError("User version conflict");
    }
    this.items.set(user.id, clone(user));
  }

  async delete_(id: string): Promise<void> {
    this.items.delete(id);
  }
}
