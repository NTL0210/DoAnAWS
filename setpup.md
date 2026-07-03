giờ làm 2 việc:

Thêm Transcribe permissions cho Step Functions role
Qua IAM → Roles
Search tên role: StepFunctions-ai-meeting-pipeline (gõ 1 phần là thấy)
Click vô role đó
Tab Permissions → Add permissions → Create inline policy
Tab JSON → dán:

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
        }
    ]
}
Next → Policy name: transcribe-policy → Create policy
Xong. Quay lại Step Functions → ai-meeting-pipeline → tab Logging xem có thấy execution nào chưa (chưa có vì chưa có EventBridge trigger).

Bước 7: Tạo EventBridge Rule
Vào EventBridge → Rules → Create rule

Event bus: default
Name: ai-pipeline-s3-trigger
Rule with an event pattern
Next
Event source: AWS events
Custom pattern (JSON editor) — dán:

{
  "source": ["aws.s3"],
  "detail-type": ["Object Created"],
  "detail": {
    "bucket": {
      "name": ["ai-meeting-audio-606065958826"]
    },
    "object": {
      "key": [{"prefix": "uploads/"}]
    }
  }
}
Next → Chọn Target: Step Functions state machine → chọn ai-meeting-pipeline
Configure input → Input transformer:
Input path:

{"bkt": "$.detail.bucket.name", "key": "$.detail.object.key"}
Template:

{"action": "transcribe", "bucket": "<bkt>", "storageKey": "<key>", "mediaFormat": "mp3"}
Next → Create rule
Xong bước 7. Anh làm tới đâu rồi?