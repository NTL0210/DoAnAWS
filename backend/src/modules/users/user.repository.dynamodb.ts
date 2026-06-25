import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";
import { ddb } from "../../infrastructure/aws/dynamodb-client.js";
import {
  text,
  textArray,
  num,
  nullableText,
  isConditionalFailure,
} from "../../infrastructure/aws/dynamodb-utils.js";
import { ConflictError, NotFoundError } from "../../shared/errors/app-error.js";
import type { UserRepository } from "./user.repository.js";
import type { User } from "./user.types.js";

const entityType = "USER";

function pk(userId: string): string {
  return `USER#${userId}`;
}

function sk(userId: string): string {
  return `PROFILE#${userId}`;
}

interface UserItem extends Record<string, unknown> {
  PK: string;
  SK: string;
  entityType: string;
  GSI1PK: string;
  GSI1SK: string;
}

function toItem(user: User): UserItem {
  return {
    PK: pk(user.id),
    SK: sk(user.id),
    entityType,
    GSI1PK: `EMAIL#${user.email.toLowerCase()}`,
    GSI1SK: `USER#${user.id}`,
    ...user,
  };
}

function fromItem(item: Record<string, unknown>): User {
  return {
    id: text(item.id),
    name: text(item.name),
    email: text(item.email),
    avatar: nullableText(item.avatar),
    phone: text(item.phone),
    avatarHistory: textArray(item.avatarHistory),
    role: text(item.role, "EMPLOYEE") as User["role"],
    departmentId: nullableText(item.departmentId),
    password: text(item.password),
    version: num(item.version, 1),
    createdAt: text(item.createdAt),
    updatedAt: text(item.updatedAt),
  };
}

export class DynamoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(id), SK: sk(id) },
      }),
    );
    return result.Item ? fromItem(result.Item) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `EMAIL#${normalized}`,
        },
        Limit: 1,
      }),
    );

    if (!result.Items || result.Items.length === 0) return null;
    const userId = text(result.Items[0]!.id);
    return this.findById(userId);
  }

  async findAll(): Promise<User[]> {
    // Uses a Scan with the entityType filter.
    // In production, add a GSI for listing all users.
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        IndexName: "GSI1",
        KeyConditionExpression: "entityType = :et",
        ExpressionAttributeValues: {
          ":et": entityType,
        },
      }),
    );
    return (result.Items ?? []).map(fromItem);
  }

  async create(user: User): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(user),
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) {
        throw new ConflictError("User already exists");
      }
      throw error;
    }
  }

  async update(user: User, expectedVersion: number): Promise<void> {
    try {
      await ddb.send(
        new PutCommand({
          TableName: env.DYNAMODB_TABLE_MAIN,
          Item: toItem(user),
          ConditionExpression: "#version = :expectedVersion",
          ExpressionAttributeNames: { "#version": "version" },
          ExpressionAttributeValues: { ":expectedVersion": expectedVersion },
        }),
      );
    } catch (error) {
      if (isConditionalFailure(error)) {
        throw new ConflictError("User version conflict");
      }
      if (isConditionalFailure(error)) {
        throw new NotFoundError("User not found");
      }
      throw error;
    }
  }

  async delete_(id: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: env.DYNAMODB_TABLE_MAIN,
        Key: { PK: pk(id), SK: sk(id) },
      }),
    );
  }
}
