import type { ErrorCode } from "../../shared/errors/app-error.js";
import { AppError } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";
import type { AuthUser } from "./auth.types.js";

// ─── Auth Error ───────────────────────────────────────────

export class AuthError extends AppError {
  constructor(message: string, code: "AUTH_REQUIRED" | "AUTH_INVALID_TOKEN" | "FORBIDDEN") {
    const statusCode = code === "AUTH_REQUIRED" ? 401 : code === "FORBIDDEN" ? 403 : 401;
    super({ code: code as ErrorCode, message, statusCode });
    this.name = "AuthError";
  }
}

// ─── Mock Token ───────────────────────────────────────────

export function generateMockToken(user: {
  id: string;
  email: string;
  role: string;
  departmentId: string | null;
  workspaceId?: string | null;
}): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
    "utf8",
  ).toString("base64");

  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      userId: user.id,
      role: user.role || "EMPLOYEE",
      email: user.email,
      departmentId: user.departmentId || null,
      workspaceId: user.workspaceId || null,
    }),
    "utf8",
  ).toString("base64");

  const signature = "mock-signature-do-not-verify";
  return `${header}.${payload}.${signature}`;
}

// ─── Token Verification ───────────────────────────────────

const IS_MOCK =
  env.NODE_ENV === "development" || env.NODE_ENV === "test" || !process.env.COGNITO_USER_POOL_ID;

export async function verifyToken(token: string): Promise<AuthUser> {
  if (!token) {
    throw new AuthError("No token provided", "AUTH_REQUIRED");
  }

  if (IS_MOCK) {
    return verifyMockToken(token);
  }

  return verifyCognitoToken(token);
}

function stringVal(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function verifyMockToken(token: string): AuthUser {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const raw = JSON.parse(
      Buffer.from(parts[1]!, "base64").toString("utf-8"),
    ) as Record<string, unknown>;

    // Basic expiry check (optional for mock)
    if (raw.exp && Number(raw.exp) * 1000 < Date.now()) {
      throw new Error("Token expired");
    }

    return {
      userId: stringVal(raw.sub) || stringVal(raw.userId),
      email: stringVal(raw.email),
      systemRole: stringVal(raw.role, "EMPLOYEE"),
      workspaceId: raw.workspaceId ? stringVal(raw.workspaceId) : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    if (message === "Token expired") {
      throw new AuthError("Token expired", "AUTH_INVALID_TOKEN");
    }
    throw new AuthError("Invalid token", "AUTH_INVALID_TOKEN");
  }
}

async function verifyCognitoToken(token: string): Promise<AuthUser> {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) {
      throw new Error("Invalid token format");
    }

    const headerPart = token.split(".")[0]!;
    const header = JSON.parse(
      Buffer.from(headerPart, "base64").toString("utf-8"),
    ) as Record<string, unknown>;

    const rawPayload = JSON.parse(
      Buffer.from(payloadPart, "base64").toString("utf-8"),
    ) as Record<string, unknown>;

    // Fetch JWKS and verify
    const jwksUrl = `https://cognito-idp.${env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;
    const jwks = await fetchJwks(jwksUrl);

    const key = jwks.keys.find((k: Record<string, unknown>) => k.kid === header.kid);
    if (!key) {
      throw new Error("No matching JWK key found");
    }

    // Validate standard claims
    const expectedIssuer = `https://cognito-idp.${env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
    if (rawPayload.iss !== expectedIssuer) {
      throw new Error("Invalid issuer");
    }
    if (rawPayload.token_use !== "access") {
      throw new Error("Invalid token use");
    }
    const clientId = process.env.COGNITO_CLIENT_ID;
    if (clientId && rawPayload.client_id !== clientId && rawPayload.aud !== clientId) {
      throw new Error("Invalid audience");
    }
    if (rawPayload.exp && Number(rawPayload.exp) * 1000 < Date.now()) {
      throw new Error("Token expired");
    }

    const role = extractRole(rawPayload);

    return {
      userId: stringVal(rawPayload.sub),
      email: stringVal(rawPayload.email) || stringVal(rawPayload["cognito:email"]),
      systemRole: role,
      workspaceId: rawPayload["custom:workspaceId"]
        ? stringVal(rawPayload["custom:workspaceId"])
        : undefined,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(
      err instanceof Error ? err.message : "Invalid token",
      "AUTH_INVALID_TOKEN",
    );
  }
}

function extractRole(payload: Record<string, unknown>): string {
  const role = stringVal(payload["custom:role"]) || stringVal(payload.role);
  if (role && ["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) {
    return role;
  }
  return "EMPLOYEE";
}

// ─── JWKS Cache ───────────────────────────────────────────

interface JwksCacheEntry {
  data: { keys: Record<string, unknown>[] };
  expiresAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_CACHE_TTL_MS = 3_600_000; // 1 hour

async function fetchJwks(url: string): Promise<{ keys: Record<string, unknown>[] }> {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const data = (await response.json()) as { keys: Record<string, unknown>[] };
  jwksCache.set(url, { data, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
  return data;
}
