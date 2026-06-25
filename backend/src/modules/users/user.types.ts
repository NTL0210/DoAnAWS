export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  phone: string;
  avatarHistory: string[];
  role: UserRole;
  departmentId: string | null;
  password?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  avatar?: string | undefined;
  role?: UserRole | undefined;
  departmentId?: string | undefined;
}

export interface UpdateUserInput {
  name?: string | undefined;
  avatar?: string | null | undefined;
  phone?: string | undefined;
  avatarHistory?: string[] | undefined;
  expectedVersion: number;
}
