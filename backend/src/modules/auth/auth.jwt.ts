import type { ErrorCode } from "../../shared/errors/app-error.js";
import { AppError } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";
import type { AuthUser } from "./auth.types.js";

export class AuthError extends AppError {
  constructor(message: string, code: "AUTH_REQUIRED" | "AUTH_INVALID_TOKEN" | "FORBIDDEN") {
    const statusCode = code === "AUTH_REQUIRED" ? 401 : code === "FORBIDDEN" ? 403 : 401;
    super({ code: code as ErrorCode, message, statusCode });
    this.name = "AuthError";
  }
}

export async function verifyToken(token: string): Promise<AuthUser> {
  if (!token) {
    throw new AuthError("No token provided", "AUTH_REQUIRED");
  }
  return verifyCognitoToken(token);
}

function stringVal(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function verifyCognitoToken(token: string): Promise<AuthUser> {
  try {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    if (!userPoolId) {
      throw new Error("Cognito user pool is not configured");
    }

    const [headerPart, payloadPart] = token.split(".");
    if (!headerPart || !payloadPart) {
      throw new Error("Invalid token format");
    }

    const header = JSON.parse(
      Buffer.from(headerPart, "base64").toString("utf-8"),
    ) as Record<string, unknown>;

    const rawPayload = JSON.parse(
      Buffer.from(payloadPart, "base64").toString("utf-8"),
    ) as Record<string, unknown>;

    const jwksUrl = `https://cognito-idp.${env.AWS_REGION}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const jwks = await fetchJwks(jwksUrl);

    const key = jwks.keys.find((k: Record<string, unknown>) => k.kid === header.kid);
    if (!key) {
      throw new Error("No matching JWK key found");
    }

    const expectedIssuer = `https://cognito-idp.${env.AWS_REGION}.amazonaws.com/${userPoolId}`;
    if (rawPayload.iss !== expectedIssuer) {
      throw new Error("Invalid issuer");
    }
    const tokenUse = stringVal(rawPayload.token_use);
    if (tokenUse !== "access" && tokenUse !== "id") {
      throw new Error("Invalid token use");
    }
    const clientId = process.env.COGNITO_CLIENT_ID;
    const tokenClientId = tokenUse === "id" ? rawPayload.aud : rawPayload.client_id;
    if (clientId && tokenClientId !== clientId) {
      throw new Error("Invalid audience");
    }
    if (rawPayload.exp && Number(rawPayload.exp) * 1000 < Date.now()) {
      throw new Error("Token expired");
    }

    const role = extractRole(rawPayload);

    return {
      userId: stringVal(rawPayload.sub),
      email: stringVal(rawPayload.email) || stringVal(rawPayload["cognito:email"]),
      name:
        stringVal(rawPayload.name) ||
        stringVal(rawPayload.preferred_username) ||
        stringVal(rawPayload.username) ||
        stringVal(rawPayload["cognito:username"]),
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

interface JwksCacheEntry {
  data: { keys: Record<string, unknown>[] };
  expiresAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const JWKS_CACHE_TTL_MS = 3_600_000;

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
