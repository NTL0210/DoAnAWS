import { z } from "zod";

export const workspaceRoleSchema = z.enum([
  "OWNER",
  "VICE_ADMIN",
  "MANAGER",
  "EMPLOYEE",
]);

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  ownerId: z.string().min(1).optional(),
  description: z.string().max(2000).optional(),
  iconColor: z.string().max(20).optional(),
  workspaceType: z.string().max(50).optional(),
  visibility: z.string().max(20).optional(),
});

export const workspaceMemberSchema = z.object({
  userId: z.string(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
  nickname: z.string().nullable(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export const workspaceChannelSchema = z.object({
  id: z.string(),
  workspaceId: z.string().optional(),
  name: z.string(),
  type: z.enum(["text", "voice"]),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  scope: z.string().optional(),
  teamId: z.string().nullable().optional(),
  allowedTeamIds: z.array(z.string()).optional(),
  allowedUserIds: z.array(z.string()).optional(),
  deniedUserIds: z.array(z.string()).optional(),
  isLocked: z.boolean().optional(),
  allowRecording: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const workspaceTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  managerId: z.string().optional(),
  memberIds: z.array(z.string()),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  iconColor: z.string().max(20).optional(),
  visibility: z.string().max(20).optional(),
  channels: z.array(workspaceChannelSchema).optional(),
  teams: z.array(workspaceTeamSchema).optional(),
  members: z.array(workspaceMemberSchema).optional(),
  messages: z.record(z.unknown()).optional(),
  voiceRecords: z.array(z.string()).optional(),
  expectedVersion: z.coerce.number().int().positive(),
});

export const createWorkspaceAttachmentUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(240),
  contentType: z.string().min(1).max(120).default("application/octet-stream"),
  size: z.coerce.number().int().nonnegative().max(25 * 1024 * 1024).optional(),
});

export const listWorkspacesSchema = z.object({
  userId: z.string().optional(),
});

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: workspaceRoleSchema.optional().default("EMPLOYEE"),
});

export const removeMemberParamsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});
