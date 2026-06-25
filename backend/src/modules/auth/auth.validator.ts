import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export const authHeadersSchema = z.object({
  authorization: z.string().min(1),
  "x-workspace-id": z.string().min(1).optional(),
});
