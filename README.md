# AI Meeting Workforce Platform

Repo layout:

```text
frontend/  Next.js app, mock UI/data, voice signaling helper
backend/   Node.js 22 + TypeScript API prepared for DynamoDB
```

Common commands from the repo root:

```bash
npm run dev:frontend
npm run dev:backend
npm run build
npm run lint
npm run test:backend
```

Cost posture:

- Start with `DATA_PROVIDER=mock` and DynamoDB Local.
- Keep backend deploy serverless or scale-to-zero while traffic is low.
- Keep monthly target around `30-50` credits by limiting AI/audio jobs and avoiding always-on infrastructure.
- See `backend/README.md` for DynamoDB and deployment details.
