const BAD_TEXT = new Set(['undefined', 'null', 'nan', 'invalid date']);

export function safeText(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  if (!text || BAD_TEXT.has(text.toLowerCase())) return fallback;
  return text;
}

export function getConfidenceLabel(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 'Not available';
  if (score >= 0.85) return 'High';
  if (score >= 0.65) return 'Medium';
  return 'Low';
}

export function getConfidencePercent(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

export function formatTimestamp(value) {
  const text = safeText(value);
  if (!text) return '';
  return text.replace(/^00:/, '');
}

export function formatSourceEvidence(task = {}) {
  const confidence = task.confidenceScore ?? task.aiConfidence ?? task.confidence;
  const sourceMeetingTitle = safeText(
    task.sourceMeetingTitle,
    task.sourceMeetingId ? 'Linked meeting' : ''
  );

  return {
    confidenceLabel: getConfidenceLabel(confidence),
    confidencePercent: getConfidencePercent(confidence),
    reason: safeText(task.reason),
    sourceMeetingTitle,
    sourceQuote: safeText(task.transcriptExcerpt || task.sourceQuote, 'No source excerpt available.'),
    sourceTimestamp: formatTimestamp(task.sourceTimestamp),
  };
}

export function formatConfidenceText(evidence) {
  if (!evidence || evidence.confidenceLabel === 'Not available') {
    return 'Confidence: Not available';
  }

  if (evidence.confidencePercent == null) {
    return `Confidence: ${evidence.confidenceLabel}`;
  }

  return `Confidence: ${evidence.confidenceLabel} ${evidence.confidencePercent}%`;
}
