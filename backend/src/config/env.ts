import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATA_PROVIDER: z.enum(["mock", "dynamodb"]).default("mock"),
  AWS_REGION: z.string().min(1).default("ap-southeast-1"),
  DYNAMODB_ENDPOINT: z.string().url().optional(),
  DYNAMODB_TABLE_MAIN: z.string().min(1).default("ai-meeting-workforce-dev"),
  LOG_LEVEL: z.string().default("warn"),
  COST_PROFILE: z.enum(["low-cost", "balanced", "performance"]).default("low-cost"),
  MONTHLY_BUDGET_CREDITS: z.coerce.number().positive().default(50)
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
