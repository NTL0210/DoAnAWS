# Hướng dẫn tạo Layer 3 — AI Processing Pipeline (Console)

> Region: **ap-southeast-1** (Singapore)
>
> **2 Lambda riêng biệt:**
> | Lambda | Handler | Chức năng |
> |--------|---------|-----------|
> | `ai-pipeline-prompt` | `index.handler` | Đọc transcript → ghép prompt → gọi Gemini |
> | `ai-pipeline-save` | `save.handler` | Lưu DynamoDB + in-app notification + cleanup S3 |
>
> ## Luồng đầy đủ
> ```
> User upload .mp3/.wav lên S3 (uploads/)
>  → EventBridge → Step Functions
>
> Step Functions (dùng AWS SDK Integration — không cần Lambda):
>  ├─ [1] StartTranscribeJob     (SDK gọi trực tiếp Amazon Transcribe, tiếng Việt)
>  ├─ [2] Wait 30s
>  ├─ [3] GetTranscriptionJob     (SDK kiểm tra trạng thái)
>  ├─ [4] Check: COMPLETED → tiếp, FAILED → dừng, IN_PROGRESS → quay lại [2]
>  │
>  ├─ [5] PromptAndAnalyze        (LAMBDA 1: đọc transcript S3 → Gemini → kết quả)
>  ├─ [6] SaveResults             (LAMBDA 2: DynamoDB + in-app notification)
>  ├─ [7] PublishToSNS            (SDK: email fallback cho user)
>  └─ [8] End
>
> CloudWatch:
>  ├─ Logs: mỗi Lambda log meetingId, latency, token usage, error
>  ├─ Metrics: custom metrics cho duration từng bước
>  ├─ Alarm: Lambda Error > 5, Gemini Timeout, Transcribe Failed
>  └─ Dashboard: tổng quan pipeline hôm nay
> ```

---

## Bước 1: IAM Role cho 2 Lambda

Tạo **1 role duy nhất** dùng chung cho cả 2 Lambda.

1. Vào **IAM → Roles → Create role**
2. Trusted entity: **AWS service** → **Lambda**
3. **Next** → click **"Create policy"** (mở tab mới)
4. Tab **JSON**, dán:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["transcribe:StartTranscriptionJob","transcribe:GetTranscriptionJob"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:ListBucket"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem","dynamodb:UpdateItem","dynamodb:PutItem","dynamodb:BatchWriteItem"],
      "Resource": "arn:aws:dynamodb:ap-southeast-1:*:table/ai-meeting-platform*"
    }
  ]
}
```

5. Đặt tên: `ai-pipeline-lambda-policy` → **Create policy**
6. Quay lại → chọn policy vừa tạo + `AWSLambdaBasicExecutionRole`
7. Role name: `ai-pipeline-lambda-role` → **Create role**

---

## Bước 2: S3 Bucket (Audio Storage)

1. **S3 → Create bucket**
2. Bucket name: `ai-meeting-audio-{số account}` (vd: `ai-meeting-audio-123456789012`)
3. Region: `ap-southeast-1`, Block all public access = ON
4. **Create bucket**

### 2.1 Bật EventBridge
- Tab **Properties** → Amazon EventBridge → **Edit** → **On** → **Save**

### 2.2 Lifecycle Glacier
- Tab **Management** → **Create lifecycle rule**
- Tên: `ArchiveAudio`, prefix: `uploads/`
- Tick: **Transition current versions** (Day 30 → Glacier) + **Expire current versions** (Day 120)
- Tick xác nhận → **Create rule**

### 2.3 Tạo folder
- Tab **Objects** → **Create folder**: `uploads/`
- **Create folder**: `transcripts/`

---

## Bước 3: SNS Topic (Notification)

1. **SNS → Topics → Create topic** → **Standard**
2. Name: `ai-pipeline-notify` → **Create topic**
3. Tab **Subscriptions** → **Create subscription**
4. Protocol: **Email** → Endpoint: email của anh
5. **Create subscription** → ra hòm thư click Confirm

---

## Bước 4: DynamoDB

Dùng table **`ai-meeting-platform`** có sẵn (PK: String, SK: String). Không cần tạo mới.

---

## Bước 5: Chuẩn bị file zip cho 2 Lambda

Mở terminal tại `backend/lambdas/ai-processing/`:

```powershell
# Copy file shared vào cùng thư mục
cp ..\shared\summaryNotification.js .

# Zip code (dùng cho cả 2 Lambda — chỉ khác handler)
Compress-Archive -Path index.js, save.js, geminiService.js, package.json, summaryNotification.js -DestinationPath ai-package.zip
```

---

## Bước 5.1: Lambda 1 — `ai-pipeline-prompt`

| Setting | Value |
|---------|-------|
| Function name | `ai-pipeline-prompt` |
| Runtime | **Node.js 22.x** |
| Architecture | **arm64** |
| Permissions | Use existing role → `ai-pipeline-lambda-role` |
| Handler | **`index.handler`** |

**Code**: Upload `ai-package.zip` → **Save**

**Environment variables:**

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `AIzaSy...` (key Gemini của anh) |
| `GEMINI_MODEL` | `gemini-2.0-flash` |
| `AWS_REGION` | `ap-southeast-1` |

**Timeout**: 3 min — **Memory**: 256 MB

---

## Bước 5.2: Lambda 2 — `ai-pipeline-save`

| Setting | Value |
|---------|-------|
| Function name | `ai-pipeline-save` |
| Runtime | **Node.js 22.x** |
| Architecture | **arm64** |
| Permissions | Use existing role → `ai-pipeline-lambda-role` |
| Handler | **`save.handler`** |

**Code**: Upload `ai-package.zip` → **Save**

**Environment variables:**

| Key | Value |
|-----|-------|
| `TABLE_NAME` | `ai-meeting-platform` |
| `AWS_REGION` | `ap-southeast-1` |

**Timeout**: 2 min — **Memory**: 256 MB

---

## Bước 6: Step Functions

### Lấy ARN cần dùng

| ARN của | Dạng |
|---------|------|
| Lambda `ai-pipeline-prompt` | `arn:aws:lambda:ap-southeast-1:{số}:function:ai-pipeline-prompt` |
| Lambda `ai-pipeline-save` | `arn:aws:lambda:ap-southeast-1:{số}:function:ai-pipeline-save` |
| SNS `ai-pipeline-notify` | `arn:aws:sns:ap-southeast-1:{số}:ai-pipeline-notify` |

### Tạo State Machine

1. **Step Functions → Create state machine**
2. **Write your workflow in code** → Type: **Standard**
3. Mở file `backend/statemachine/pipeline.asl.json`, copy toàn bộ nội dung
4. Dán vào editor → thay 3 biến bằng ARN thật:
   - `${PromptLambdaArn}` → ARN của `ai-pipeline-prompt`
   - `${SaveLambdaArn}` → ARN của `ai-pipeline-save`
   - `${NotifyTopicArn}` → ARN của SNS `ai-pipeline-notify`
5. **Next**
6. Name: `ai-meeting-pipeline`
7. Permissions: **Choose an existing role**

### Tạo role cho Step Functions

Mở tab mới → **IAM → Roles → Create role**:

- Trusted entity: **Step Functions**
- **Create policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": [
        "arn:aws:lambda:ap-southeast-1:{số}:function:ai-pipeline-prompt",
        "arn:aws:lambda:ap-southeast-1:{số}:function:ai-pipeline-save"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:ap-southeast-1:{số}:ai-pipeline-notify"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogDelivery",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

- Đặt tên policy: `ai-pipeline-sfn-policy` → **Create**
- Role name: `ai-pipeline-sfn-role` → **Create role**

Quay lại Step Functions → **Refresh** → chọn `ai-pipeline-sfn-role`

**Logging** → **ALL**, tick **Include execution data**

**Create state machine**

---

## Bước 7: EventBridge Rule

1. **EventBridge → Rules → Create rule**
2. Event bus: **default**
3. Name: `ai-pipeline-s3-trigger`
4. **Rule with an event pattern**
5. Source: **AWS events**
6. **Custom pattern** (JSON):

```json
{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": {
    "bucket": {
      "name": ["ai-meeting-audio-{số account của anh}"]
    },
    "object": {
      "key": [{"prefix": "uploads/"}]
    }
  }
}
```

7. **Next** → Target: **Step Functions state machine** → chọn `ai-meeting-pipeline`
8. **Configure input → Input transformer**:
   - Input path:
   ```json
   {"bkt": "$.detail.bucket.name", "key": "$.detail.object.key"}
   ```
   - Template:
   ```json
   {"action": "transcribe", "bucket": "<bkt>", "storageKey": "<key>", "mediaFormat": "mp3"}
   ```
9. **Next** → tạo role → **Next** → **Create rule**

---

## Bước 8: CloudWatch Alarm

1. **CloudWatch → Alarms → Create alarm**
2. **Select metric** → **States** → `ExecutionsFailed`
3. Dimension: `StateMachineArn` = ARN của `ai-meeting-pipeline`
4. Period: **5 phút**, Threshold: `>= 1`
5. **Next** → Notification → **In alarm** → chọn SNS `ai-pipeline-notify`
6. Alarm name: `ai-pipeline-failed` → **Create alarm**

---

## ✅ Kiểm tra

```bash
aws s3 cp test-meeting.mp3 s3://ai-meeting-audio-{số}/uploads/test-001.mp3 --region ap-southeast-1
```

Vào **Step Functions** → `ai-meeting-pipeline` → **Executions**: xem graph chạy từng bước.

Kiểm tra:
- **DynamoDB**: tìm `MEETING#test-001` → `status: AI_REVIEW_READY`
- **CloudWatch Logs**: `/aws/lambda/ai-pipeline-prompt` và `/aws/lambda/ai-pipeline-save`
- **Email**: nhận "AI Analysis Complete"

---

## 📊 CloudWatch Dashboard (khuyên dùng, sau này setup)

Sau khi pipeline chạy ổn, tạo Dashboard để monitor:
1. **CloudWatch → Dashboards → Create dashboard**
2. Add widget → **Logs Insights** → query:
   ```
   fields @timestamp, @message
   | filter @message like /Process/
   | sort @timestamp desc
   | limit 20
   ```
3. Add **Alarm** widget → chọn `ai-pipeline-failed`
4. Thêm **Number** widget → Metrics → States → `ExecutionsSucceeded`, period 1 day
5. Tên dashboard: `AI Pipeline Overview`
