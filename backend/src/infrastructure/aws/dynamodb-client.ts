import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "../../config/env.js";

const localOptions = env.DYNAMODB_ENDPOINT
  ? {
      endpoint: env.DYNAMODB_ENDPOINT,
      credentials: {
        accessKeyId: "local",
        secretAccessKey: "local"
      }
    }
  : {};

export const dynamodbBaseClient = new DynamoDBClient({
  region: env.AWS_REGION,
  ...localOptions
});

export const ddb = DynamoDBDocumentClient.from(dynamodbBaseClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});
