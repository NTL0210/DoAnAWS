import { describe, expect, it } from "vitest";
import {
  decodeNextToken,
  encodeNextToken
} from "../../src/shared/pagination/token.js";

describe("pagination token", () => {
  it("round-trips a DynamoDB LastEvaluatedKey as an opaque token", () => {
    const key = { PK: "WORKSPACE#ws-1", SK: "TASK#task-1" };
    const token = encodeNextToken(key);
    expect(token).toBeTypeOf("string");
    expect(token).not.toContain("WORKSPACE");
    expect(decodeNextToken(token)).toEqual(key);
  });

  it("rejects malformed tokens", () => {
    expect(() => decodeNextToken("not-a-token")).toThrow("Invalid pagination token");
  });
});
