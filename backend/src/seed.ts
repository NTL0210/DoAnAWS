import { buildRepositories } from "./app/repositories.js";
import { MeetingService } from "./modules/meetings/meeting.service.js";
import { TaskService } from "./modules/tasks/task.service.js";

const repositories = buildRepositories();
const meetings = new MeetingService(repositories.meetings);
const tasks = new TaskService(repositories.tasks);

await meetings.create({
  workspaceId: "ws-1",
  teamId: "team-3",
  title: "Seeded backend meeting",
  transcriptText: "TODO: DOMAIN_DECISION_REQUIRED replace with imported transcript.",
  createdBy: "seed"
});

await tasks.create({
  workspaceId: "ws-1",
  title: "Seeded backend task",
  description: "Created by backend seed script.",
  createdBy: "seed",
  priority: "MEDIUM"
});

console.log("Seed complete");
