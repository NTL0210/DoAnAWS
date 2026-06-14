import { env } from "../config/env.js";
import { DynamoMeetingRepository } from "../modules/meetings/meeting.repository.dynamodb.js";
import { MockMeetingRepository } from "../modules/meetings/meeting.repository.mock.js";
import type { MeetingRepository } from "../modules/meetings/meeting.repository.js";
import { DynamoTaskRepository } from "../modules/tasks/task.repository.dynamodb.js";
import { MockTaskRepository } from "../modules/tasks/task.repository.mock.js";
import type { TaskRepository } from "../modules/tasks/task.repository.js";

export interface Repositories {
  meetings: MeetingRepository;
  tasks: TaskRepository;
}

export function buildRepositories(
  provider: "mock" | "dynamodb" = env.DATA_PROVIDER,
): Repositories {
  if (provider === "dynamodb") {
    return {
      meetings: new DynamoMeetingRepository(),
      tasks: new DynamoTaskRepository()
    };
  }
  return {
    meetings: new MockMeetingRepository(),
    tasks: new MockTaskRepository()
  };
}
