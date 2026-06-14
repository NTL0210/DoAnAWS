import { z } from "zod";

export const meetingStatusSchema = z.enum([
  "UPLOADED",
  "PROCESSING",
  "AI_REVIEW_READY",
  "COMPLETED",
  "FAILED"
]);

export const createMeetingSchema = z.object({
  workspaceId: z.string().min(1),
  teamId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  transcriptText: z.string().max(200_000).optional(),
  storageRef: z.string().max(500).optional(),
  createdBy: z.string().min(1).optional()
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: meetingStatusSchema.optional(),
  summary: z.string().max(20_000).optional(),
  expectedVersion: z.coerce.number().int().positive()
});

export const listMeetingsSchema = z.object({
  workspaceId: z.string().min(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  nextToken: z.string().optional()
});

export const idParamsSchema = z.object({
  id: z.string().min(1)
});
