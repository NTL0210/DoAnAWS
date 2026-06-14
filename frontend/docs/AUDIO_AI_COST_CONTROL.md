# Audio and AI Cost Control

This project should keep audio and AI work out of always-on app servers when it moves to AWS.

- Upload large recordings directly to S3 with presigned URLs. Do not proxy raw audio through Next.js API routes.
- Store browser recordings as WebM/Opus by default. Convert to MP3 only when download/share support or an AI provider requires it.
- Use S3 lifecycle rules: delete unpinned raw recordings after 7-14 days, delete unpinned processed MP3 files after 30 days, and keep small transcript/summary/task JSON longer.
- Before creating AI jobs, compute a client-side file hash and check existing transcript/summary/task caches.
- Cache transcript results by audio hash, summaries by `transcriptHash + promptVersion`, and task generation by `summaryHash + promptVersion`.
- Split processing into upload, create job, async worker, and slow polling or realtime progress updates. Stop polling when jobs reach `completed` or `failed`.
- Back off polling when work is old or the tab is hidden: 3-5s for fresh jobs, 10-15s after 1 minute, and about 30s after 5 minutes.
- Keep Socket.IO payloads small. Send deltas for presence, typing, speaking, and processing progress; never send audio over Socket.IO.
- Log job metadata only: `jobId`, status, duration, size, and cost estimate. Avoid logging long raw transcripts.
- For demo/student deployments, prefer S3, Lambda for light APIs, SQS for queues, and DynamoDB or a managed free-tier database. Avoid NAT Gateway and always-on ECS/Fargate until the workload justifies them.
