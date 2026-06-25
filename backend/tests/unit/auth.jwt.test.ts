import { describe, expect, it } from "vitest";
import {
  generateMockToken,
  verifyToken,
  AuthError,
} from "../../src/modules/auth/auth.jwt.js";

describe("generateMockToken", () => {
  it("produces a 3-part dot-separated token", () => {
    const token = generateMockToken({
      id: "user-1",
      email: "a@b.com",
      role: "ADMIN",
      departmentId: null,
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("encodes userId in the payload", () => {
    const token = generateMockToken({
      id: "user-42",
      email: "x@y.com",
      role: "MEMBER",
      departmentId: null,
    });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64").toString("utf-8"),
    );
    expect(payload.sub).toBe("user-42");
    expect(payload.email).toBe("x@y.com");
    expect(payload.role).toBe("MEMBER");
  });

  it("encodes workspaceId when provided", () => {
    const token = generateMockToken({
      id: "u1",
      email: "u@c.com",
      role: "OWNER",
      departmentId: null,
      workspaceId: "ws-42",
    });
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1]!, "base64").toString("utf-8"),
    );
    expect(payload.workspaceId).toBe("ws-42");
  });
});

describe("verifyToken (mock mode)", () => {
  it("returns AuthUser for a valid mock token", async () => {
    const token = generateMockToken({
      id: "user-1",
      email: "admin@company.com",
      role: "ADMIN",
      departmentId: null,
      workspaceId: "ws-1",
    });
    const user = await verifyToken(token);
    expect(user.userId).toBe("user-1");
    expect(user.email).toBe("admin@company.com");
    expect(user.systemRole).toBe("ADMIN");
    expect(user.workspaceId).toBe("ws-1");
  });

  it("uses userId as fallback when sub is missing", async () => {
    const token = generateMockToken({
      id: "custom-id",
      email: "u@c.com",
      role: "MEMBER",
      departmentId: null,
    });
    const user = await verifyToken(token);
    expect(user.userId).toBe("custom-id");
  });

  it("throws AuthError for empty token", async () => {
    await expect(verifyToken("")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError for malformed token", async () => {
    await expect(verifyToken("not-a-token")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError for token with 2 parts", async () => {
    await expect(verifyToken("a.b")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError for token with invalid base64 payload", async () => {
    await expect(verifyToken("header.!!!.signature")).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it("throws AuthError for expired token", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
      "utf8",
    ).toString("base64");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      }),
      "utf8",
    ).toString("base64");
    const expired = `${header}.${payload}.mock-signature`;
    await expect(verifyToken(expired)).rejects.toBeInstanceOf(AuthError);
  });
});
