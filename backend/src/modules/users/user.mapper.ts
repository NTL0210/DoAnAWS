import type { User } from "./user.types.js";

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  phone: string;
  avatarHistory: string[];
  role: string;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    phone: user.phone,
    avatarHistory: user.avatarHistory,
    role: user.role,
    departmentId: user.departmentId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
