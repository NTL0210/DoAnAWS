import { describe, expect, it, vi } from "vitest";
import { DynamoUserRepository } from "../../src/modules/users/user.repository.dynamodb.js";
import { ConflictError } from "../../src/shared/errors/app-error.js";

const mockSend = vi.hoisted(() => vi.fn());

function mockCommand(input?: unknown) {
  return { input, __isMock: true };
}

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  GetCommand: vi.fn((input?: unknown) => mockCommand(input)),
  PutCommand: vi.fn((input?: unknown) => mockCommand(input)),
  DeleteCommand: vi.fn((input?: unknown) => mockCommand(input)),
  QueryCommand: vi.fn((input?: unknown) => mockCommand(input)),
  BatchWriteCommand: vi.fn((input?: unknown) => mockCommand(input)),
  TransactWriteCommand: vi.fn((input?: unknown) => mockCommand(input)),
}));

vi.mock("../../src/infrastructure/aws/dynamodb-client.js", () => ({
  ddb: { send: mockSend },
}));


function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@company.com",
    avatar: null,
    phone: "",
    avatarHistory: [],
    role: "EMPLOYEE" as const,
    departmentId: null,
    password: "hashed",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DynamoUserRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("returns user when item exists", async () => {
      mockSend.mockResolvedValueOnce({
        Item: makeUser(),
      });

      const repo = new DynamoUserRepository();
      const user = await repo.findById("user-1");

      expect(user).not.toBeNull();
      expect(user!.id).toBe("user-1");
      expect(user!.email).toBe("test@company.com");
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("returns null when item not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const repo = new DynamoUserRepository();
      const user = await repo.findById("missing");

      expect(user).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("returns user via GSI1 email lookup", async () => {
      // GSI1 query result
      mockSend.mockResolvedValueOnce({
        Items: [{ id: "user-1" }],
      });
      // Follow-up getById
      mockSend.mockResolvedValueOnce({
        Item: makeUser(),
      });

      const repo = new DynamoUserRepository();
      const user = await repo.findByEmail("test@company.com");

      expect(user).not.toBeNull();
      expect(user!.id).toBe("user-1");
      // First call is QueryCommand (GSI1 lookup), second is GetCommand (by id)
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("returns null when email not found", async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined });

      const repo = new DynamoUserRepository();
      const user = await repo.findByEmail("unknown@company.com");

      expect(user).toBeNull();
    });

    it("normalizes email to lowercase", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ id: "user-1" }],
      });
      mockSend.mockResolvedValueOnce({
        Item: makeUser(),
      });

      const repo = new DynamoUserRepository();
      await repo.findByEmail("TEST@COMPANY.COM");

      // The GSI1PK should use lowercase email
      const queryCall = mockSend.mock.calls[0]![0] as unknown as { input: Record<string, unknown> };
      const input = queryCall.input;
      expect(input.ExpressionAttributeValues?.[":pk"]).toBe(
        "EMAIL#test@company.com",
      );
    });
  });

  describe("findAll", () => {
    it("returns all users via GSI1 query", async () => {
      mockSend.mockResolvedValueOnce({
        Items: [makeUser({ id: "user-1" }), makeUser({ id: "user-2" })],
      });

      const repo = new DynamoUserRepository();
      const users = await repo.findAll();

      expect(users).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("returns empty array when no users exist", async () => {
      mockSend.mockResolvedValueOnce({ Items: undefined });

      const repo = new DynamoUserRepository();
      const users = await repo.findAll();

      expect(users).toEqual([]);
    });
  });

  describe("create", () => {
    it("succeeds for new user", async () => {
      mockSend.mockResolvedValueOnce({});

      const repo = new DynamoUserRepository();
      await expect(repo.create(makeUser())).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("throws ConflictError on duplicate user", async () => {
      const conditionalFailure = new Error("ConditionalCheckFailed");
      conditionalFailure.name = "ConditionalCheckFailedException";
      mockSend.mockRejectedValueOnce(conditionalFailure);

      const repo = new DynamoUserRepository();
      await expect(repo.create(makeUser())).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("update", () => {
    it("succeeds with matching version", async () => {
      mockSend.mockResolvedValueOnce({});

      const repo = new DynamoUserRepository();
      await expect(
        repo.update(makeUser({ version: 2 }), 1),
      ).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("throws ConflictError on version mismatch", async () => {
      const conditionalFailure = new Error("ConditionalCheckFailed");
      conditionalFailure.name = "ConditionalCheckFailedException";
      mockSend.mockRejectedValueOnce(conditionalFailure);

      const repo = new DynamoUserRepository();
      await expect(repo.update(makeUser(), 999)).rejects.toBeInstanceOf(
        ConflictError,
      );
    });
  });

  describe("delete_", () => {
    it("deletes user by id", async () => {
      mockSend.mockResolvedValueOnce({});

      const repo = new DynamoUserRepository();
      await expect(repo.delete_("user-1")).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("is idempotent for non-existent user", async () => {
      mockSend.mockResolvedValueOnce({});

      const repo = new DynamoUserRepository();
      await expect(repo.delete_("no-such-user")).resolves.toBeUndefined();
    });
  });
});
