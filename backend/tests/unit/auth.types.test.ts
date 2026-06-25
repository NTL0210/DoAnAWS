import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ROLES,
  ROLE_HIERARCHY,
  hasSufficientRole,
} from "../../src/modules/auth/auth.types.js";

describe("hasSufficientRole", () => {
  it("allows OWNER to do OWNER actions", () => {
    expect(hasSufficientRole("OWNER", "OWNER")).toBe(true);
  });

  it("allows OWNER to do ADMIN actions", () => {
    expect(hasSufficientRole("OWNER", "ADMIN")).toBe(true);
  });

  it("allows OWNER to do MEMBER actions", () => {
    expect(hasSufficientRole("OWNER", "MEMBER")).toBe(true);
  });

  it("allows ADMIN to do ADMIN actions", () => {
    expect(hasSufficientRole("ADMIN", "ADMIN")).toBe(true);
  });

  it("allows ADMIN to do MEMBER actions", () => {
    expect(hasSufficientRole("ADMIN", "MEMBER")).toBe(true);
  });

  it("denies ADMIN from doing OWNER actions", () => {
    expect(hasSufficientRole("ADMIN", "OWNER")).toBe(false);
  });

  it("allows MEMBER to do MEMBER actions", () => {
    expect(hasSufficientRole("MEMBER", "MEMBER")).toBe(true);
  });

  it("denies MEMBER from doing ADMIN actions", () => {
    expect(hasSufficientRole("MEMBER", "ADMIN")).toBe(false);
  });

  it("denies MEMBER from doing OWNER actions", () => {
    expect(hasSufficientRole("MEMBER", "OWNER")).toBe(false);
  });
});

describe("WORKSPACE_ROLES", () => {
  it("contains exactly OWNER, ADMIN, MEMBER", () => {
    expect(WORKSPACE_ROLES).toEqual(["OWNER", "ADMIN", "MEMBER"]);
  });
});

describe("ROLE_HIERARCHY", () => {
  it("assigns OWNER level 3", () => {
    expect(ROLE_HIERARCHY.OWNER).toBe(3);
  });

  it("assigns ADMIN level 2", () => {
    expect(ROLE_HIERARCHY.ADMIN).toBe(2);
  });

  it("assigns MEMBER level 1", () => {
    expect(ROLE_HIERARCHY.MEMBER).toBe(1);
  });
});
