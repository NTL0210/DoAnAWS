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
import type { Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createApp } from "./app/app.js";
import { logger } from "./infrastructure/observability/logger.js";

// ─── Cognito Event Types ────────────────────────────
// Defined locally to keep minimal type surface.
// Matches the Cognito PreSignUp / PostConfirmation trigger event shape.

interface CognitoUserAttrs {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  phone_number?: string;
  [key: string]: string | undefined;
}

interface CognitoTriggerRequest {
  userAttributes: CognitoUserAttrs;
}

interface CognitoTriggerResponse {
  autoConfirmUser?: boolean;
  autoVerifyEmail?: boolean;
  [key: string]: boolean | undefined;
}

interface CognitoTriggerEvent {
  triggerSource: string;
  userName: string;
  request: CognitoTriggerRequest;
  response: CognitoTriggerResponse;
}

// ─── Express App Setup ──────────────────────────────

const app = createApp();

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const wrappedHandler = serverlessExpress({ app });

logger.info({ event: "LAMBDA_COLD_START" }, "Lambda cold start — Express app initialised");

// ─── Cognito Handlers ───────────────────────────────

/**
 * Handle Cognito PostConfirmation trigger — auto-create user record in DynamoDB.
 */
async function handlePostConfirmation(event: CognitoTriggerEvent): Promise<CognitoTriggerEvent> {
  const { userAttributes } = event.request;
  const userName = event.userName;

  logger.info({ userName }, "[PostConfirmation] Creating DynamoDB user");

  const userId = userAttributes.sub;
  const email = userAttributes.email;
  const name = userAttributes.name || userAttributes.preferred_username || email.split("@")[0] || "User";

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
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      logger.info({ userId }, "[PostConfirmation] User already exists in DynamoDB");
    } else if (err instanceof Error) {
      logger.error({ error: err.message }, "[PostConfirmation] Error creating user");
    } else {
      logger.error({ error: String(err) }, "[PostConfirmation] Error creating user");
    }
  }

  return event;
}

/**
 * Handle Cognito PreSignUp trigger — auto-confirm user immediately.
 */
async function handlePreSignUp(event: CognitoTriggerEvent): Promise<CognitoTriggerEvent> {
  event.response.autoConfirmUser = true;
  if (event.request.userAttributes.email) {
    event.response.autoVerifyEmail = true;
  }

  logger.info({ userName: event.userName }, "[PreSignUp] Auto-confirmed user");
  return event;
}

// ─── Entry Point ────────────────────────────────────

/**
 * Lambda handler — entry point for API Gateway and all Cognito triggers.
 */
export const handler = async (
  event: CognitoTriggerEvent | Record<string, unknown>,
  context: Context,
): Promise<unknown> => {
  // Cognito PreSignUp trigger (runs BEFORE PostConfirmation)
  if ("triggerSource" in event && typeof event.triggerSource === "string") {
    if (event.triggerSource.startsWith("PreSignUp_")) {
      return handlePreSignUp(event as CognitoTriggerEvent);
    }
    if (event.triggerSource.startsWith("PostConfirmation_")) {
      return handlePostConfirmation(event as CognitoTriggerEvent);
    }
  }

  // API Gateway HTTP request
  return wrappedHandler(event, context, () => {});
};
