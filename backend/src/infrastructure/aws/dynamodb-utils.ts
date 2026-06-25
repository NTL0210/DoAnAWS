// ─── Type Guards ──────────────────────────────────────────

/** Safe string extraction from an unknown value. */
export function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Safe array-of-strings extraction from an unknown value. */
export function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => text(v)) : [];
}

/** Safe number extraction from an unknown value. */
export function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

/** Safe boolean extraction from an unknown value. */
export function bool(value: unknown): boolean {
  return Boolean(value);
}

/** Safe nullable string extraction. */
export function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : null;
}

/** Safe nullable number extraction. */
export function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : null;
}

// ─── DynamoDB Error Detection ─────────────────────────────

export function isConditionalFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ConditionalCheckFailedException"
  );
}

export function isTransactionCanceled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "TransactionCanceledException"
  );
}

// ─── Batch Retry ──────────────────────────────────────────

const MAX_BATCH_RETRIES = 5;

/**
 * Retry an operation that returns unprocessed items (BatchWrite, BatchGet).
 * Calls `operation(unprocessedItems)` and repeats with any remaining items.
 */
export async function withBatchRetry<T>(
  operation: (items: T[]) => Promise<{ unprocessed: T[] }>,
  items: T[],
  maxAttempts = MAX_BATCH_RETRIES,
): Promise<void> {
  let remaining = items;

  for (let attempt = 0; remaining.length > 0 && attempt < maxAttempts; attempt++) {
    const result = await operation(remaining);
    remaining = result.unprocessed;
  }
}
