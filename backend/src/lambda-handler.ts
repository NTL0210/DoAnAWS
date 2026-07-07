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
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
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

interface ApiGatewayHttpEvent extends Record<string, unknown> {
  rawPath?: string;
  path?: string;
  requestContext?: {
    stage?: string;
    http?: {
      path?: string;
    };
  };
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
 * Also processes any pending workspace invitations for the registered email.
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

    // Process pending invitations for this email
    await processPendingInvitations(userId, email, tableName);
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
 * Process pending workspace invitations for a newly registered user.
 * Converts invitations to notifications so the user sees them.
 */
async function processPendingInvitations(userId: string, email: string, tableName: string): Promise<void> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Query for pending invitations by email (GSI1)
    const result = await dynamoClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": { S: `EMAIL#${normalizedEmail}` },
        ":sk": { S: "INVITE#" },
      },
    }));

    const invitations = result.Items || [];
    if (invitations.length === 0) {
      logger.info({ email }, "[PostConfirmation] No pending invitations found");
      return;
    }

    logger.info({ email, count: invitations.length }, "[PostConfirmation] Processing pending invitations");

    // Convert each invitation to a notification
    for (const inv of invitations) {
      // Extract DynamoDB attribute values
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const invData = inv as unknown as Record<string, { S?: string; SS?: string[] }>;
      const workspaceId = invData.workspaceId?.S || "";
      const workspaceName = invData.workspaceName?.S || "";
      const role = invData.role?.S || "EMPLOYEE";
      const invitedBy = invData.invitedBy?.S || "";
      const invitedByUserName = invData.invitedByUserName?.S || "Unknown";
      const teamIds = invData.teamIds?.SS || [];

      // Create notification
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const notifCreatedAt = new Date().toISOString();

      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: `NOTIF#${userId}`,
          SK: `NOTIF#${notifId}`,
          id: notifId,
          userId,
          type: "INVITATION",
          title: "Workspace Invitation",
          message: `${invitedByUserName} invited you to join "${workspaceName || workspaceId}"`,
          link: null,
          isRead: false,
          metadata: {
            type: "workspace_invite",
            workspaceId,
            workspaceName,
            role,
            invitedBy,
            invitedByUserName,
            status: "PENDING",
            invitedEmail: normalizedEmail,
            teamIds,
          },
          createdAt: notifCreatedAt,
        },
      }));

      logger.info({ userId, workspaceId, notifId }, "[PostConfirmation] Invitation converted to notification");
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.warn({ error: err.message }, "[PostConfirmation] Error processing pending invitations");
    } else {
      logger.warn({ error: String(err) }, "[PostConfirmation] Error processing pending invitations");
    }
    // Don't fail the PostConfirmation if invitation processing fails
  }
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

function stripStagePrefix(path: string | undefined, stage: string | undefined): string | undefined {
  if (!path || !stage || stage === "$default") return path;

  const prefix = `/${stage}`;
  if (path === prefix) return "/";
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

function normalizeApiGatewayEvent(event: Record<string, unknown>): Record<string, unknown> {
  const apiEvent = event as ApiGatewayHttpEvent;
  const stage = apiEvent.requestContext?.stage;
  if (!stage || stage === "$default") return event;

  const normalizedRawPath = stripStagePrefix(apiEvent.rawPath, stage);
  const normalizedPath = stripStagePrefix(apiEvent.path, stage);
  const normalizedHttpPath = stripStagePrefix(apiEvent.requestContext?.http?.path, stage);

  return {
    ...apiEvent,
    ...(normalizedRawPath && { rawPath: normalizedRawPath }),
    ...(normalizedPath && { path: normalizedPath }),
    requestContext: {
      ...apiEvent.requestContext,
      http: {
        ...apiEvent.requestContext?.http,
        ...(normalizedHttpPath && { path: normalizedHttpPath }),
      },
    },
  };
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
  return wrappedHandler(normalizeApiGatewayEvent(event as Record<string, unknown>), context, () => {});
};
