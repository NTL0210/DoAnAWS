/**
 * Cost and limit constants for AWS usage optimization
 *
 * All values are mock-friendly. In API mode the real AWS limits apply,
 * but these client-side bounds prevent unnecessary requests.
 */

// ─── File size limits ───────────────────────────────────────────────
/** Maximum audio file size allowed for AI processing (500 MB) */
export const MAX_AI_AUDIO_SIZE_BYTES = 500 * 1024 * 1024;

/** Warning threshold for large audio files (350 MB) */
export const WARNING_AI_AUDIO_SIZE_BYTES = 350 * 1024 * 1024;

/** Threshold above which a CostWarningModal is always shown for file uploads (100 MB) */
export const COST_WARNING_FILE_SIZE_THRESHOLD_BYTES = 100 * 1024 * 1024;

/** Maximum transcript characters sent in a single AI request */
export const MAX_TRANSCRIPT_CHARS_FOR_SINGLE_AI_REQUEST = 100000;

/** Maximum voice recording duration in seconds (10 min) */
export const MAX_VOICE_RECORDING_DURATION_SECONDS = 600;

// ─── Workspace quota defaults ───────────────────────────────────────
/** Default max AI processing runs per workspace per day */
export const AI_DAILY_RUN_LIMIT = 10;

/** Default max concurrent AI processing jobs per workspace */
export const MAX_JOB_CONCURRENCY = 2;

/** Default max storage per workspace in GB */
export const MAX_STORAGE_GB = 5;

/** Default max voice recordings per workspace per day */
export const MAX_VOICE_RECORDINGS_PER_DAY = 20;

// ─── Polling intervals (ms) ─────────────────────────────────────────
export const POLLING_INTERVALS = {
  /** 0 s – 30 s */
  initial: 5000,
  /** 30 s – 5 min */
  medium: 15000,
  /** 5 min + */
  slow: 30000,
  /** When tab is hidden */
  background: 60000,
};

// ─── Cache TTL (ms) ─────────────────────────────────────────────────
export const CACHE_TTL = {
  workspaceOverview: 60_000,
  taskList: 30_000,
  meetingList: 30_000,
  analytics: 300_000,
  notifications: 60_000,
};

// ─── Debounce ───────────────────────────────────────────────────────
export const DEBOUNCE_MS = 300;

// ─── S3 lifecycle / retention ───────────────────────────────────────
export const RETENTION_POLICY = {
  /** Raw audio files: auto-delete after N days */
  rawAudioRetentionDays: 30,
  /** Failed-upload artifacts: auto-delete after N days */
  failedUploadRetentionDays: 7,
  /** Temporary processing files: auto-delete after N days */
  tempFileRetentionDays: 3,
  /** Whether auto-delete is enabled */
  autoDeleteEnabled: true,
};

// ─── Allowed file types ─────────────────────────────────────────────
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/ogg',
  'audio/webm',
];

export const ALLOWED_AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|ogg|webm|txt)$/i;

// ─── AI cost estimation ─────────────────────────────────────────────
/**
 * Rough cost tier thresholds (USD cents per request, mock values).
 * In production these would come from the actual model pricing.
 */
export const AI_COST_TIERS = {
  small: { maxChars: 10_000, label: 'Low', cents: 1 },
  medium: { maxChars: 50_000, label: 'Medium', cents: 5 },
  large: { maxChars: MAX_TRANSCRIPT_CHARS_FOR_SINGLE_AI_REQUEST, label: 'High', cents: 15 },
};

/** Estimated token multiplier (chars → tokens) */
export const ESTIMATED_CHARS_PER_TOKEN = 4;

// ─── Processing job statuses ────────────────────────────────────────
export const JOB_STATUSES = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  TRANSCRIBING: 'TRANSCRIBING',
  SUMMARIZING: 'SUMMARIZING',
  TASK_EXTRACTION: 'TASK_EXTRACTION',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

/** Terminal statuses — polling should stop when reached */
export const TERMINAL_JOB_STATUSES = [
  JOB_STATUSES.COMPLETED,
  JOB_STATUSES.FAILED,
  JOB_STATUSES.CANCELLED,
];

// ─── Quota action keys ──────────────────────────────────────────────
export const QUOTA_ACTIONS = {
  AI_PROCESSING: 'ai_processing',
  VOICE_RECORDING: 'voice_recording',
  STORAGE: 'storage',
};
