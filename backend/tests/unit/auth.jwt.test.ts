import { describe, expect, it } from "vitest";
import { verifyToken, AuthError } from "../../src/modules/auth/auth.jwt.js";

describe("verifyToken", () => {
  it("throws AuthError for empty token", async () => {
    await expect(verifyToken("")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError for malformed token", async () => {
    await expect(verifyToken("not-a-token")).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError for unsigned token-like input", async () => {
    await expect(verifyToken("header.payload.signature")).rejects.toBeInstanceOf(
      AuthError,
    );
  });
});
