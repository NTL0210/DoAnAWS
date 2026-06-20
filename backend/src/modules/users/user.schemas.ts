import { z } from "zod";

export const userRoleSchema = z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]);

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  avatar: z.string().max(500).optional(),
  role: userRoleSchema.optional(),
  departmentId: z.string().min(1).optional()
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).optional(),
  avatarHistory: z.array(z.string().max(500)).max(5).optional(),
  expectedVersion: z.coerce.number().int().positive()
});

export const idParamsSchema = z.object({
  id: z.string().min(1)
});

export const emailQuerySchema = z.object({
  email: z.string().email().optional()
});
