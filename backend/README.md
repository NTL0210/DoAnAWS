# AI Meeting Workforce Backend

Production-ready backend scaffold for moving the current mock-data app toward Amazon DynamoDB.

## Stack

- Node.js 22 + TypeScript strict mode
- Express 5 public API mounted at `/api/v1`
- Zod validation, Pino structured logging, request id middleware
- AWS SDK v3 with `DynamoDBDocumentClient.from(...)`
- Feature-first modules with router, controller, service, repository interface, mock repository, DynamoDB repository

## File Tree

```text
backend/
  src/
    app/
    config/
    infrastructure/
    shared/
    modules/
      meetings/
      tasks/
  tests/
    unit/
    integration/
    e2e/
  docker/
  infra/
    terraform/
    cloudformation/
```

## Local Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

## Low-Cost Defaults

The default profile is designed to stay cheap while the product is still validating real usage:

- Target budget: `MONTHLY_BUDGET_CREDITS=50`.
- Default provider: `DATA_PROVIDER=mock`, so local/dev does not touch AWS.
- Default logs: `LOG_LEVEL=warn`, reducing noisy CloudWatch ingestion later.
- DynamoDB billing: on-demand, so there is no always-on provisioned capacity.
- DynamoDB Local for development at `http://localhost:8000`.
- PITR is enabled by default only for `prod` in the sample IaC when `low_cost_mode=true`.
- Frontend AI/audio limits are intentionally conservative in `frontend/.env.example`.

Recommended deployment shape for a 30-50 credit/month target:

- Host frontend as static/edge output on a cheap static host where possible.
- Use serverless or scale-to-zero compute for the backend during early traffic.
- Keep DynamoDB on-demand until traffic becomes predictable.
- Do not enable OpenAI/Transcribe/audio processing for every user action; queue it and enforce daily caps.
- Store large audio/transcripts in object storage with lifecycle expiry, never in DynamoDB.

Health endpoints:

- `GET /healthz`
- `GET /readyz`

API endpoints:

- `GET /api/v1/meetings?workspaceId=ws-1&limit=20`
- `POST /api/v1/meetings`
- `GET /api/v1/meetings/:id?workspaceId=ws-1`
- `PATCH /api/v1/meetings/:id?workspaceId=ws-1`
- `GET /api/v1/tasks?workspaceId=ws-1&limit=20`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:id?workspaceId=ws-1`
- `PATCH /api/v1/tasks/:id?workspaceId=ws-1`

Error format:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "...",
    "requestId": "..."
  }
}
```

## Switch Mock to DynamoDB

Use mock repositories:

```env
DATA_PROVIDER=mock
```

Use DynamoDB:

```env
DATA_PROVIDER=dynamodb
AWS_REGION=ap-southeast-1
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_TABLE_MAIN=ai-meeting-workforce-dev
```

Only repository implementations import AWS SDK. Controllers never call repositories directly; services never know Express request/response.

## DynamoDB Local

Run local DynamoDB at `http://localhost:8000`:

```bash
docker compose -f docker/docker-compose.dynamodb-local.yml up -d
```

Create the table locally:

```bash
aws dynamodb create-table \
  --endpoint-url http://localhost:8000 \
  --table-name ai-meeting-workforce-dev \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S AttributeName=GSI1PK,AttributeType=S AttributeName=GSI1SK,AttributeType=S AttributeName=GSI2PK,AttributeType=S AttributeName=GSI2SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[{"IndexName":"GSI1","KeySchema":[{"AttributeName":"GSI1PK","KeyType":"HASH"},{"AttributeName":"GSI1SK","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},{"IndexName":"GSI2","KeySchema":[{"AttributeName":"GSI2PK","KeyType":"HASH"},{"AttributeName":"GSI2SK","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}]'
```

Enable TTL locally or in AWS:

```bash
aws dynamodb update-time-to-live \
  --endpoint-url http://localhost:8000 \
  --table-name ai-meeting-workforce-dev \
  --time-to-live-specification Enabled=true,AttributeName=expiresAt
```

Seed data:

```bash
npm run seed
```

## DynamoDB Design Notes

- Main table keys: `PK`, `SK`.
- `GSI1` lists meetings/tasks by workspace and creation time.
- `GSI2` lists tasks by workspace + assignee.
- Pagination uses opaque tokens encoded from `LastEvaluatedKey`.
- `QueryCommand` is used for list paths; avoid `Scan` for request paths.
- Large audio/transcript blobs should live in S3. DynamoDB stores metadata/reference only via `storageRef`.
- `version` supports optimistic locking with `ConditionExpression`.
- `expiresAt` is the TTL field for temporary or expiring items.
- `BatchGetCommand` retry exists in `meeting.repository.dynamodb.ts`.
- `BatchWriteCommand` retry and `TransactWriteCommand` all-or-nothing examples exist in `task.repository.dynamodb.ts`.

## Tests

```bash
npm test
npm run test:unit
npm run test:integration
```

Integration tests are designed for DynamoDB Local. Start the container and set `DATA_PROVIDER=dynamodb` when expanding them.

## Deploy

Terraform:

```bash
cd infra/terraform
terraform init
terraform apply \
  -var="name=ai-meeting-workforce-dev" \
  -var="environment=dev" \
  -var="low_cost_mode=true"
```

CloudFormation:

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation/dynamodb.yml \
  --stack-name ai-meeting-workforce-dev \
  --parameter-overrides TableName=ai-meeting-workforce-dev Environment=dev LowCostMode=true
```

GitHub Actions workflow is in `.github/workflows/deploy.yml` and uses OIDC through `aws-actions/configure-aws-credentials`. Replace the placeholder AWS role ARN with one trusted for the repository.

Environment flow:

- `dev`: mock by default, DynamoDB Local when needed, no PITR in low-cost mode.
- `staging`: DynamoDB on-demand, small seed data, short retention for temporary records.
- `prod`: deletion protection and PITR stay enabled; deploy through protected environment approvals.

## Domain TODOs

- TODO: DOMAIN_DECISION_REQUIRED confirm tenant model: `workspaceId` only, or organization + workspace.
- TODO: DOMAIN_DECISION_REQUIRED decide where transcripts/audio live permanently. Current backend stores `storageRef` only.
- TODO: DOMAIN_DECISION_REQUIRED define auth/permission checks before exposing production traffic.
