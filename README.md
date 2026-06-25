# AI Meeting Workforce Platform

Repo layout:

```text
frontend/  Next.js app, mock UI/data, voice signaling helper
backend/   Node.js 22 + TypeScript API prepared for DynamoDB
```

Install and run from the repo root:

```bash
npm install
npm run dev:frontend
```

Voice chat uses a separate signaling process:

```bash
npm run dev:voice
```

Other useful commands:

```bash
npm run dev:backend
npm run build
npm run lint
npm run test:backend
```

Environment files:

- Copy `frontend/.env.example` to `frontend/.env` for local frontend and Next.js API route settings.
- Copy `backend/.env.example` to `backend/.env` for backend API settings.
- Keep real secrets in `.env` files only. `.env.example` files are templates and should not contain private keys.

Cost posture:

- Start with `DATA_PROVIDER=mock` and DynamoDB Local.
- Keep backend deploy serverless or scale-to-zero while traffic is low.
- Keep monthly target around `30-50` credits by limiting AI/audio jobs and avoiding always-on infrastructure.
- See `backend/README.md` for DynamoDB and deployment details.
