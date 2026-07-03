/**
 * Gemini AI Service — gọi Gemini API (free) thay vì Amazon Bedrock
 *
 * Hỗ trợ:
 *   - Text-only: callGemini()
 *   - File API (audio lớn): uploadToGemini() + callGeminiWithFile()
 *
 * File API dùng cho audio dài (1-2h meeting) — upload file lên Gemini,
 * sau đó gửi file URI + prompt. Free tier hỗ trợ file đến 2GB, lưu 48h.
 *
 * @module lambdas/ai-processing/geminiService
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gọi Gemini API (text-only).
 */
export async function callGemini(model, prompt, opts = {}) {
  return callGeminiWithParts(model, [{ text: prompt }], opts);
}

/**
 * Upload file (MP3/WAV) lên Gemini File API.
 * Hỗ trợ file lớn dùng resumable upload.
 *
 * @param {Buffer} fileBuffer — binary content
 * @param {string} mimeType — "audio/mpeg" | "audio/wav" | ...
 * @returns {Promise<string>} fileUri — vd "files/abc-123"
 */
export async function uploadToGemini(fileBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const uploadUrl = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
  const url = `${uploadUrl}?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start, upload, finalize',
      'X-Goog-Upload-Header-Content-Length': String(fileBuffer.length),
      'Content-Type': mimeType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini upload failed ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const fileUri = data?.file?.uri;
  if (!fileUri) {
    throw new Error(`Gemini upload missing fileUri: ${JSON.stringify(data)}`);
  }

  console.log(`[GeminiUpload] File uploaded: ${fileUri}, size: ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  return fileUri;
}

/**
 * Gọi Gemini với file URI từ File API.
 *
 * @param {string} model — "gemini-2.5-flash"
 * @param {string} fileUri — từ uploadToGemini()
 * @param {string} mimeType — "audio/mpeg"
 * @param {string} textPrompt — prompt
 * @param {Object} [opts] — { temperature, maxOutputTokens }
 * @returns {Promise<string>}
 */
export async function callGeminiWithFile(model, fileUri, mimeType, textPrompt, opts = {}) {
  return callGeminiWithParts(model, [
    {
      fileData: { mimeType, fileUri },
    },
    { text: textPrompt },
  ], opts);
}

/**
 * Gọi Gemini với audio inline (file nhỏ < 20MB).
 */
export async function callGeminiWithAudio(model, base64Audio, mimeType, textPrompt, opts = {}) {
  return callGeminiWithParts(model, [
    { inlineData: { mimeType, data: base64Audio } },
    { text: textPrompt },
  ], opts);
}

/** Internal: gọi Gemini generateContent */
async function callGeminiWithParts(model, parts, opts = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  const temperature = opts.temperature ?? 0.3;
  const maxOutputTokens = opts.maxOutputTokens ?? 8192;

  const body = {
    contents: [{ parts }],
    generationConfig: { temperature, maxOutputTokens },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) {
    throw new Error('Gemini returned empty response — check prompt or quota');
  }

  return text;
}

/**
 * Hàm tiện ích: bóc ```json ... ``` khỏi response nếu có.
 */
export function extractJson(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Cannot parse Gemini response as JSON: ${text.slice(0, 200)}...`);
  }
}

// ─── Prompt Templates ──────────────────────────────────

export const SYSTEM_PROMPT_AUDIO = `Bạn là trợ lý phân tích cuộc họp chuyên nghiệp.

Hãy nghe file audio cuộc họp này và thực hiện:
1. Transcribe toàn bộ nội dung bằng tiếng Việt (giữ nguyên speaker nếu phân biệt được)
2. Tóm tắt ngắn gọn (summary)
3. Các quyết định quan trọng (keyDecisions)
4. Danh sách công việc cần làm (tasks) — mỗi task có title, description, assignee (nếu có), priority (HIGH/MEDIUM/LOW), deadline (nếu có)
5. Các rủi ro / vấn đề cần theo dõi (risks)

CHỈ trả về JSON, không thêm chữ nào khác:
{
  "transcript": "...",
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "tasks": [
    {
      "title": "...",
      "description": "...",
      "assignee": "...",
      "priority": "HIGH|MEDIUM|LOW",
      "deadline": "YYYY-MM-DD"
    }
  ],
  "risks": ["...", "..."]
}

Nguyên tắc:
- Chỉ lấy thông tin được đề cập rõ ràng
- Nếu không có assignee/deadline thì để rỗng
- Tóm tắt ngắn gọn, đủ ý chính`;

export const SYSTEM_PROMPT_ANALYZE = `Bạn là trợ lý phân tích cuộc họp chuyên nghiệp.

Dựa vào transcript cuộc họp dưới đây, hãy phân tích và trả về:
1. Tóm tắt ngắn gọn bằng tiếng Việt (summary)
2. Các quyết định quan trọng (keyDecisions)
3. Danh sách công việc cần làm (tasks) — mỗi task có title, description, assignee (nếu có), priority (HIGH/MEDIUM/LOW), deadline (nếu có)
4. Các rủi ro / vấn đề cần theo dõi (risks)

CHỈ trả về JSON, không thêm chữ nào khác:
{
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "tasks": [
    {
      "title": "Tên công việc",
      "description": "Mô tả chi tiết",
      "assignee": "Tên người được giao (nếu có)",
      "priority": "HIGH|MEDIUM|LOW",
      "deadline": "YYYY-MM-DD (nếu có)"
    }
  ],
  "risks": ["...", "..."]
}

Nguyên tắc:
- Chỉ lấy thông tin được đề cập rõ ràng trong transcript
- Nếu không có ai được giao, để assignee là rỗng
- Nếu không có deadline, để deadline là rỗng
- Tóm tắt ngắn gọn, đủ ý chính`;

export default { callGemini, extractJson, uploadToGemini, callGeminiWithFile, callGeminiWithAudio };
