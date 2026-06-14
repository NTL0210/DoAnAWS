# AWS Cost Control

## Upload Flow

- Client requests a presigned S3 upload URL with file name, size, MIME type, workspace ID, and file hash.
- Client uploads audio directly to S3. Large audio should not pass through Next.js API routes.
- Backend stores only metadata: storage key, hash, duration, size, owner, workspace, and retention policy.

## Processing Flow

- Create a small processing job after upload.
- Worker processes transcript, summary, and task suggestions asynchronously.
- Frontend uses smart polling or small realtime progress events.
- Stop polling when a job reaches `completed`, `failed`, or `cancelled`.

## Cache Strategy

- Transcript cache key: `audioHash`.
- Summary cache key: `transcriptHash + promptVersion`.
- Task generation cache key: `summaryHash + promptVersion`.
- Cache hits should show "Reused previous analysis" and skip AI calls.

## Quota Strategy

- Daily audio minutes per workspace.
- Daily AI processing count per workspace/user.
- Max file size and max recording duration.
- Show warnings before expensive or large jobs.

## Lifecycle Strategy

- Raw recordings: delete after 7-14 days unless pinned.
- Converted MP3: delete after 30 days unless pinned.
- Transcript, summary, and task JSON can be retained longer because they are small.

## Recommended Demo Services

- S3 for audio files.
- DynamoDB or MongoDB Atlas free tier for metadata.
- Lambda for light APIs.
- SQS for async job queue if needed.

## Avoid During Demo

- NAT Gateway unless required.
- Always-on ECS/Fargate before real production load.
- Sending audio over Socket.IO.
- Logging raw audio or long transcripts.
