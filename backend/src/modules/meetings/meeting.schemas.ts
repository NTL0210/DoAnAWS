import { z } from "zod";
import { workspaceMemberRoleSchema } from "../workspaces/workspace.schemas.js";

export const meetingStatusSchema = z.enum([
  "UPLOADED",
  "PROCESSING",
  "AI_REVIEW_READY",
  "TASKS_GENERATED",
  "COMPLETED",
  "FAILED"
]);

export const createMeetingSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  title: z.string().max(200).optional(),
  transcriptText: z.string().max(200_000).optional(),
  storageRef: z.string().max(500).optional(),
  createdBy: z.string().min(1).optional()
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: meetingStatusSchema.optional(),
  summary: z.string().max(20_000).optional(),
  storageRef: z.string().max(500).optional(),
  transcriptText: z.string().max(200_000).optional(),
  keyDecisions: z.array(z.string().max(1_000)).optional(),
  risks: z.array(z.string().max(1_000)).optional(),
  actionItems: z.array(z.string().max(1_000)).optional(),
  suggestedTasks: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().max(5_000).default(""),
    assigneeId: z.string().min(1).nullable().optional().default(null),
    assignee: z.string().max(200).optional(),
    teamId: z.string().min(1).nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    deadline: z.string().date().nullable().optional().default(null),
    confidence: z.coerce.number().min(0).max(1).default(0.5),
    approved: z.boolean().optional(),
    sourceQuote: z.string().max(10_000).optional(),
    reason: z.string().max(2_000).optional(),
  }).passthrough()).optional(),
  generatedTaskIds: z.array(z.string().min(1)).optional(),
  expectedVersion: z.coerce.number().int().positive().optional()
});

export const createMeetingUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255).optional(),
  fileSize: z.coerce.number().int().nonnegative().optional(),
});

export const listMeetingsSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  nextToken: z.string().optional()
});

export const listNotificationsSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
});

export const sendInvitationSchema = z.object({
  workspaceId: z.string().min(1),
  workspaceName: z.string().min(1).max(200).optional(),
  inviteeEmail: z.string().email().max(255),
  role: workspaceMemberRoleSchema.optional().default("EMPLOYEE"),
  teamIds: z.array(z.string().min(1)).optional().default([]),
});

export const updateNotificationSchema = z.object({
  action: z.enum(["accept", "decline", "read"]).optional().default("read"),
});

export const idParamsSchema = z.object({
  id: z.string().min(1)
});
