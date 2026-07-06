import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import { bool, text } from "../../infrastructure/aws/dynamodb-utils.js";

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function pk(userId: string): string {
  return `NOTIF#${userId}`;
}

function sk(notificationId: string): string {
  return `NOTIF#${notificationId}`;
}

function fromItem(item: Record<string, unknown>): NotificationRecord {
  return {
    id: text(item.id),
    userId: text(item.userId),
    type: text(item.type, "INFO"),
    title: text(item.title),
    message: text(item.message),
    link: typeof item.link === "string" ? item.link : null,
    isRead: bool(item.isRead),
    metadata: isRecord(item.metadata) ? item.metadata : {},
    createdAt: text(item.createdAt),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class NotificationRepository {
  async create(input: {
    id?: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationRecord> {
    const now = new Date().toISOString();
    const id = input.id ?? `inv-${randomUUID()}`;
    const item = {
      PK: pk(input.userId),
      SK: sk(id),
      entityType: "NOTIFICATION",
      id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      isRead: false,
      metadata: input.metadata ?? {},
      createdAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Item: item,
      }),
    );

    return fromItem(item);
  }

  async findByUser(userId: string, options: { unreadOnly?: boolean } = {}): Promise<NotificationRecord[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": pk(userId),
          ":sk": "NOTIF#",
        },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );

    let notifications = (result.Items ?? []).map(fromItem);
    if (options.unreadOnly) {
      notifications = notifications.filter((notification) => !notification.isRead);
    }
    return notifications;
  }

  async findById(userId: string, notificationId: string): Promise<NotificationRecord | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(userId), SK: sk(notificationId) },
      }),
    );

    return result.Item ? fromItem(result.Item) : null;
  }

  async updateStatus(
    userId: string,
    notificationId: string,
    status: "ACCEPTED" | "DECLINED" | "READ",
  ): Promise<NotificationRecord | null> {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(userId), SK: sk(notificationId) },
        UpdateExpression: "SET isRead = :read, metadata.#status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":read": true,
          ":status": status,
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes ? fromItem(result.Attributes) : null;
  }
}
