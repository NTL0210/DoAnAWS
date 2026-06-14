import { z } from "zod";

export const taskStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createTaskSchema = z.object({
  workspaceId: z.string().min(1),
  meetingId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().min(1).optional(),
  createdBy: z.string().min(1).optional(),
  priority: taskPrioritySchema.default("MEDIUM"),
  deadline: z.string().date().optional()
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: taskStatusSchema.optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  expectedVersion: z.coerce.number().int().positive()
});

export const listTasksSchema = z.object({
  workspaceId: z.string().min(1),
  assigneeId: z.string().min(1).optional(),
  meetingId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  nextToken: z.string().optional()
});

export const idParamsSchema = z.object({
  id: z.string().min(1)
});
