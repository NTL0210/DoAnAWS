/**
 * Lambda Handler — wraps the Express app for API Gateway + Lambda deployments.
 *
 * Also handles Cognito triggers (PreSignUp + PostConfirmation) so the architecture
 * stays at exactly 3 Lambda functions (no separate presignup function).
 *
 * Usage:
 *   Deploy dist/lambda-handler.js as the Lambda function handler.
 *   API Gateway (HTTP API or REST API) proxies all requests to this handler.
 *   Cognito PreSignUp + PostConfirmation triggers also point to this same function.
 *
 * Local dev still uses server.ts directly:
 *   npx tsx src/app/server.ts
 */

import { configure as serverlessExpress } from "@codegenie/serverless-express";
import type { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createApp } from "./app/app.js";
import { logger } from "./infrastructure/observability/logger.js";

/**
 * The Express app instance. Built once at cold start, reused across invocations.
 */
const app = createApp();

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const wrappedHandler = serverlessExpress({ app });

logger.info({ event: "LAMBDA_COLD_START" }, "Lambda cold start — Express app initialised");

/**
 * Handle Cognito PostConfirmation trigger — auto-create user record in DynamoDB.
 */
async function handlePostConfirmation(event: any): Promise<any> {
  const { userAttributes } = event.request;
  const userName = event.userName;

  logger.info({ userName }, "[PostConfirmation] Creating DynamoDB user");

  const userId = userAttributes.sub;
  const email = userAttributes.email;
  const name = userAttributes.name || userAttributes.preferred_username || email?.split("@")[0] || "User";

  if (!userId || !email) {
    logger.error("[PostConfirmation] Missing userId or email in Cognito attributes");
    return event;
  }

  const now = new Date().toISOString();
  const tableName = process.env.DYNAMODB_TABLE || "ai-meeting-platform";

  try {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: `USER#${userId}`,
        SK: `PROFILE#${userId}`,
        id: userId,
        name,
        email: email.toLowerCase(),
        avatar: userAttributes.picture || null,
        phone: userAttributes.phone_number || "",
        avatarHistory: [],
        role: "EMPLOYEE",
        departmentId: null,
        GSI1PK: `EMAIL#${email.toLowerCase()}`,
        GSI1SK: `USER#${userId}`,
        GSI2PK: "ROLE#EMPLOYEE",
        GSI2SK: `PROFILE#${userId}`,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    logger.info({ userId }, "[PostConfirmation] DynamoDB user created");
  } catch (err: any) {
    if (err.name === "ConditionalCheckFailedException") {
      logger.info({ userId }, "[PostConfirmation] User already exists in DynamoDB");
    } else {
      logger.error({ error: err.message }, "[PostConfirmation] Error creating user");
    }
  }

  return event;
}

/**
 * Handle Cognito PreSignUp trigger — auto-confirm user immediately.
 */
async function handlePreSignUp(event: any): Promise<any> {
  event.response.autoConfirmUser = true;
  if (event.request.userAttributes?.email) {
    event.response.autoVerifyEmail = true;
  }

  logger.info({ userName: event.userName }, "[PreSignUp] Auto-confirmed user");
  return event;
}

/**
 * Lambda handler — entry point for API Gateway and all Cognito triggers.
 *
 * - PreSignUp_*  → auto-confirm user (no separate Lambda needed)
 * - PostConfirmation_* → create DynamoDB user record
 * - has httpMethod → API Gateway request → serverless-express
 */
export const handler: Handler = async (event: any, context: any) => {
  // Cognito PreSignUp trigger (runs BEFORE PostConfirmation)
  if (event.triggerSource?.startsWith("PreSignUp_")) {
    return handlePreSignUp(event);
  }

  // Cognito PostConfirmation trigger
  if (event.triggerSource?.startsWith("PostConfirmation_")) {
    return handlePostConfirmation(event);
  }

  // API Gateway HTTP request
  return wrappedHandler(event, context, () => {});
};
