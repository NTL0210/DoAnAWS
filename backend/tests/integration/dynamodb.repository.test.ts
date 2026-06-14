import { describe, expect, it } from "vitest";

const endpoint = process.env.DYNAMODB_ENDPOINT;

describe.skipIf(!endpoint)("DynamoDB repository integration", () => {
  it("is ready for DynamoDB Local integration tests", () => {
    expect(endpoint).toContain("localhost:8000");
  });
});
