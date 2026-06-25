/**
 * Lambda Handler — wraps the Express app for API Gateway + Lambda deployments.
 *
 * Usage:
 *   Deploy dist/lambda-handler.js as the Lambda function handler.
 *   API Gateway (HTTP API or REST API) proxies all requests to this handler.
 *
 * Local dev still uses server.ts directly:
 *   npx tsx src/app/server.ts
 */

import { configure as serverlessExpress } from "@codegenie/serverless-express";
import type { Handler } from "aws-lambda";
import { createApp } from "./app/app.js";
import { logger } from "./infrastructure/observability/logger.js";

/**
 * The Express app instance. Built once at cold start, reused across invocations.
 * This significantly reduces latency after the first request.
 */
const app = createApp();

logger.info({ event: "LAMBDA_COLD_START" }, "Lambda cold start — Express app initialised");

/**
 * Lambda handler — entry point for API Gateway → Lambda.
 *
 * @param event - API Gateway HTTP API or REST API event
 * @param context - Lambda execution context
 * @returns API Gateway-formatted response
 */
export const handler: Handler = serverlessExpress({ app });
