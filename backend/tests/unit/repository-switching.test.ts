import { describe, expect, it } from "vitest";
import { buildRepositories } from "../../src/app/repositories.js";
import { MockMeetingRepository } from "../../src/modules/meetings/meeting.repository.mock.js";
import { DynamoMeetingRepository } from "../../src/modules/meetings/meeting.repository.dynamodb.js";

describe("repository provider switching", () => {
  it("builds mock repositories", () => {
    expect(buildRepositories("mock").meetings).toBeInstanceOf(MockMeetingRepository);
  });

  it("builds DynamoDB repositories", () => {
    expect(buildRepositories("dynamodb").meetings).toBeInstanceOf(
      DynamoMeetingRepository,
    );
  });
});
