# Backend Migration Plan

## From Client-Side Mock Data to Server-Side Real Database

This document describes the step-by-step migration from the current client-side mock data architecture to a production-ready backend with a real database and API endpoints.

---

## Current Architecture

```
Browser (Next.js Pages)
    │
    ├── Direct mock data (via legacyDataService)
    │     └── src/lib/mockData.js (in-memory objects)
    │
    ├── API routes (via pages/api/)
    │     └── Middleware → Services → Mock Repositories
    │
    └── WorkspaceContext (via src/context/)
          └── Repository layer → Mock Repositories
```

---

## Target Architecture

```
Browser (Next.js Pages)
    │
    ├── React Query / SWR (data fetching)
    │     └── Calls API routes only
    │
    ├── API Gateway (AWS API Gateway)
    │     └── Routes to Lambda functions
    │
    └── Lambda Functions
          └── Middleware → Services → MongoDB Repository
                └── MongoDB Atlas / DocumentDB
```

---

## Phase 1: Activate API Routes (Week 1)

### Step 1.1 — Set up MongoDB

1. Create a MongoDB Atlas cluster (free tier is sufficient for MVP).
2. Create database `ai-meeting-platform` with collections as specified in `DATABASE_DESIGN.md`.
3. Set up indexes for the access patterns documented.
4. Add connection string to `.env`:
   ```env
   MONGODB_URI=mongodb+srv://...
   NEXT_PUBLIC_DATA_PROVIDER=mongodb
   ```

### Step 1.2 — Install dependencies

```bash
npm install mongoose
```

### Step 1.3 — Create Mongoose models

Create `src/repositories/mongodb/` directory with model files matching each collection:

- `mongodbUserRepository.js`
- `mongodbWorkspaceRepository.js`
- `mongodbTaskRepository.js`
- `mongodbMeetingRepository.js`
- `mongodbTeamRepository.js`
- `mongodbChannelRepository.js`
- `mongodbMessageRepository.js`
- `mongodbNotificationRepository.js`
- `mongodbVoiceRepository.js`

Each Mongoose repository must implement the same interface as the mock repository (see JSDoc in `src/repositories/interfaces/`).

### Step 1.4 — Update repository factory

In `src/repositories/index.js`, add the MongoDB repository switch:

```js
const provider = process.env.NEXT_PUBLIC_DATA_PROVIDER || 'mock';

export const Users = provider === 'mongodb' 
  ? require('./mongodb/mongodbUserRepository').default
  : require('./mock/mockUserRepository').default;
// ... etc for each repository
```

### Step 1.5 — Seed the database

Create a seed script at `scripts/seed.js` that inserts `src/data/seed/` data into MongoDB.

---

## Phase 2: Migrate Frontend Data Fetching (Week 2)

### Step 2.1 — Install data fetching library

```bash
npm install @tanstack/react-query
```

### Step 2.2 — Create API client hooks

Create `src/hooks/useApi.js` with helpers for each entity:

```js
// Example
export function useTasks(filters) {
  return useQuery(['tasks', filters], () =>
    fetch(`/api/tasks?${new URLSearchParams(filters)}`).then(r => r.json())
  );
}
```

### Step 2.3 — Migrate each page

For every page that currently loads mock data via `legacyDataService`, replace with API calls:

| Page | Replace with |
|------|-------------|
| admin/dashboard.jsx | `useQuery('/api/dashboard/admin')` |
| admin/tasks.jsx | `useQuery('/api/tasks')` |
| admin/users.jsx | `useQuery('/api/users')` |
| manager/dashboard.jsx | `useQuery('/api/dashboard/manager')` |
| manager/tasks.jsx | `useQuery('/api/tasks?departmentId=...')` |
| employee/dashboard.jsx | `useQuery('/api/dashboard/employee')` |
| employee/tasks.jsx | `useQuery('/api/tasks?assigneeId=...')` |

### Step 2.4 — Add loading/error/empty states

Each page already has loading states; verify they work with async API calls.

---

## Phase 3: Authentication & JWT (Week 2-3)

### Step 3.1 — Implement Cognito or JWT auth

Replace the simplified JWT in `pages/api/middleware/withAuth.js` with Amazon Cognito verification:

```js
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID,
});
```

### Step 3.2 — Update login flow

Replace `userService.loginUser()` mock with real Cognito authentication.

### Step 3.3 — Protect all API routes

Ensure every API route uses `withAuth()` and appropriate role guards.

---

## Phase 4: AI Processing Pipeline (Week 3-4)

### Step 4.1 — Create async processing queue

Replace the synchronous mock AI processing with an async queue:

```text
POST /api/meetings/[id]/process
      ↓
Enqueue to SQS / Bull queue
      ↓
Worker picks up job
      ↓
Call OpenAI API / AWS Bedrock
      ↓
Save results to MongoDB
      ↓
Notify user via notification
```

### Step 4.2 — Implement file upload

Replace the client-side mock upload with S3 signed URLs:

```text
POST /api/upload/presign
      → returns { uploadUrl, fileKey }
Client uploads directly to S3
      → PUT to uploadUrl
POST /api/meetings
      → { title, fileKey, departmentId }
```

### Step 4.3 — Wire up Amazon Transcribe

For audio files, trigger Transcribe job after upload:

```text
Audio uploaded to S3
      → S3 Event Notification
      → Lambda starts Transcribe job
      → Transcribe completes
      → Lambda processes with AI
      → Save summary + tasks
```

---

## Phase 5: Deployment (Week 4)

### Step 5.1 — Serverless deployment

If using AWS Lambda + API Gateway:

1. Configure `serverless.yml` or AWS CDK for infrastructure.
2. Deploy API routes as Lambda functions.
3. Set up API Gateway with Cognito authorizer.
4. Configure VPC for Lambda to access MongoDB Atlas.

### Step 5.2 — Environment configuration

```env
# Production
NEXT_PUBLIC_DATA_PROVIDER=mongodb
MONGODB_URI=mongodb+srv://production-uri
COGNITO_USER_POOL_ID=...
COGNITO_CLIENT_ID=...
AWS_REGION=us-east-1
OPENAI_API_KEY=...
```

### Step 5.3 — Monitoring

Set up CloudWatch dashboards for:
- API latency and error rates
- AI processing success/failure rates
- Task creation rates
- User activity metrics

---

## Testing Checklist

Before each deployment, verify:

- [ ] `npm run build` passes
- [ ] Login/logout works
- [ ] Admin can view all departments, users, meetings, tasks
- [ ] Manager can view only own department data
- [ ] Employee can view only own tasks
- [ ] Task CRUD operations work
- [ ] Meeting upload + AI processing works
- [ ] Notifications appear for task assignments
- [ ] API routes return proper error responses for:
  - Missing JWT → 401
  - Wrong role → 403
  - Invalid input → 400
  - Missing resource → 404
- [ ] Rate limiting is configured for API routes
- [ ] No secrets exposed in client-side code

---

## Rollback Plan

If the MongoDB migration causes issues:

1. Set `NEXT_PUBLIC_DATA_PROVIDER=mock` to revert to mock data.
2. The `legacyDataService.js` wrapper still works — all pages fall back to mock data.
3. Fix MongoDB issues in the repository layer without touching UI code.
4. Re-deploy with `NEXT_PUBLIC_DATA_PROVIDER=mongodb` once fixed.

This is the key benefit of the repository pattern: **the UI never knows which data source is active**.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| MongoDB connection failures | Connection pooling + retry logic in repository |
| Slow queries | Proper indexes from Day 1 (see DATABASE_DESIGN.md) |
| API latency vs client-side mock | Add React Query caching + optimistic updates |
| AI processing timeout | Async queue with status polling |
| JWT token expiration | Automatic refresh in withAuth middleware |
| Data inconsistency | Use MongoDB transactions for multi-document operations |
