import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app/app.js";
import { buildRepositories } from "../../src/app/repositories.js";

function bodyOf(response: request.Response): Record<string, unknown> {
  return response.body as Record<string, unknown>;
}

describe("HTTP API", () => {
  const app = createApp(buildRepositories("mock"));

  it("serves health checks", async () => {
    await request(app).get("/healthz").expect(200, { status: "ok" });
  });

  it("creates and lists tasks through /api/v1", async () => {
    const created = await request(app)
      .post("/api/v1/tasks")
      .send({ workspaceId: "ws-1", title: "Connect frontend to backend" })
      .expect(201);

    expect(bodyOf(created).id).toBeTypeOf("string");

    const listed = await request(app)
      .get("/api/v1/tasks")
      .query({ workspaceId: "ws-1" })
      .expect(200);

    const items = bodyOf(listed).items;
    expect(Array.isArray(items) ? items.length : 0).toBeGreaterThan(0);
  });

  it("returns standardized validation errors with request id", async () => {
    const response = await request(app)
      .post("/api/v1/meetings")
      .send({ workspaceId: "ws-1" })
      .expect(400);

    const error = bodyOf(response).error as Record<string, unknown>;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.requestId).toBeTypeOf("string");
  });
});
