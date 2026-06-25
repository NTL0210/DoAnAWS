import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app/app.js";
import { buildRepositories } from "../../src/app/repositories.js";
import { generateMockToken } from "../../src/modules/auth/auth.jwt.js";

function bodyOf(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

const mockToken = generateMockToken({
  id: "user-1",
  email: "admin@company.com",
  role: "ADMIN",
  departmentId: null,
  workspaceId: "ws-1",
});

const authHeader = `Bearer ${mockToken}`;

describe("HTTP API", () => {
  const app = createApp(buildRepositories("mock"));

  it("serves health checks", async () => {
    await request(app).get("/healthz").expect(200, { status: "ok" });
  });

  it("rejects unauthenticated requests", async () => {
    await request(app)
      .post("/api/v1/tasks")
      .send({ workspaceId: "ws-1", title: "No auth" })
      .expect(401);
  });

  it("creates and lists tasks through /api/v1", async () => {
    const created = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", authHeader)
      .set("x-workspace-id", "ws-1")
      .send({ title: "Connect frontend to backend" })
      .expect(201);

    expect(bodyOf(created).id).toBeTypeOf("string");

    const listed = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", authHeader)
      .set("x-workspace-id", "ws-1")
      .expect(200);

    const items = bodyOf(listed).items;
    expect(Array.isArray(items) ? items.length : 0).toBeGreaterThan(0);
  });

  it("returns standardized validation errors with request id", async () => {
    const response = await request(app)
      .post("/api/v1/meetings")
      .set("Authorization", authHeader)
      .set("x-workspace-id", "ws-1")
      .send({})
      .expect(400);

    const error = bodyOf(response).error as Record<string, unknown>;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.requestId).toBeTypeOf("string");
  });

  it("returns current user from /me endpoint", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", authHeader)
      .expect(200);

    const user = bodyOf(response);
    expect(user.id).toBe("user-1");
    expect(user.email).toBe("admin@company.com");
  });
});
