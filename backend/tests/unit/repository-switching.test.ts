import { describe, expect, it } from "vitest";
import { buildRepositories } from "../../src/app/repositories.js";
import { DynamoAuditRepository } from "../../src/modules/audit/audit.repository.dynamodb.js";
import { DynamoMeetingRepository } from "../../src/modules/meetings/meeting.repository.dynamodb.js";
import { DynamoTaskRepository } from "../../src/modules/tasks/task.repository.dynamodb.js";
import { DynamoUserRepository } from "../../src/modules/users/user.repository.dynamodb.js";

describe("repository provider", () => {
  it("builds DynamoDB repositories", () => {
    const repositories = buildRepositories();
    expect(repositories.meetings).toBeInstanceOf(DynamoMeetingRepository);
    expect(repositories.tasks).toBeInstanceOf(DynamoTaskRepository);
    expect(repositories.users).toBeInstanceOf(DynamoUserRepository);
    expect(repositories.audit).toBeInstanceOf(DynamoAuditRepository);
  });
});
