import type { User } from "./user.types.js";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(user: User): Promise<void>;
  update(user: User, expectedVersion: number): Promise<void>;
  delete_(id: string): Promise<void>;
}
