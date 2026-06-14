import { describe, expect, it } from "vitest";
import { ConflictError } from "../../src/shared/errors/app-error.js";
import { MockMeetingRepository } from "../../src/modules/meetings/meeting.repository.mock.js";
import { MeetingService } from "../../src/modules/meetings/meeting.service.js";

describe("MeetingService", () => {
  it("creates a meeting without leaking HTTP concerns into service", async () => {
    const repo = new MockMeetingRepository([]);
    const service = new MeetingService(repo);

    const meeting = await service.create({
      workspaceId: "ws-1",
      title: " Planning "
    });

    expect(meeting.title).toBe("Planning");
    expect(meeting.version).toBe(1);
    await expect(
      service.get({ workspaceId: "ws-1", meetingId: meeting.id }),
    ).resolves.toMatchObject({ id: meeting.id });
  });

  it("raises conflict on stale optimistic locking version", async () => {
    const repo = new MockMeetingRepository([]);
    const service = new MeetingService(repo);
    const meeting = await service.create({ workspaceId: "ws-1", title: "Kickoff" });

    await service.update({
      workspaceId: "ws-1",
      meetingId: meeting.id,
      patch: { title: "Updated", expectedVersion: 1 }
    });

    await expect(
      service.update({
        workspaceId: "ws-1",
        meetingId: meeting.id,
        patch: { title: "Stale", expectedVersion: 1 }
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
