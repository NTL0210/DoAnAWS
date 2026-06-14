export type PageKey = Record<string, unknown>;

export function encodeNextToken(key?: PageKey): string | undefined {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

export function decodeNextToken(token?: string): PageKey | undefined {
  if (!token) return undefined;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid pagination token payload");
    }
    return parsed as PageKey;
  } catch {
    throw new Error("Invalid pagination token");
  }
}
