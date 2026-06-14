const DEFAULT_THRESHOLD = 0.7;

export function detectDuplicateSuggestions(suggestions = [], existingTasks = [], threshold = DEFAULT_THRESHOLD) {
  const existing = existingTasks
    .filter((task) => !task.deletedAt && !task.archivedAt)
    .map((task) => ({ ...task, duplicateType: 'existing' }));

  return suggestions.map((suggestion, index) => {
    const candidates = [];
    const peers = suggestions
      .filter((_, peerIndex) => peerIndex !== index)
      .map((task) => ({ ...task, duplicateType: 'suggested' }));

    [...peers, ...existing].forEach((candidate) => {
      const score = getTaskSimilarity(suggestion, candidate);
      if (score >= threshold) {
        candidates.push({
          id: candidate.id,
          title: candidate.title,
          status: candidate.status,
          duplicateType: candidate.duplicateType,
          similarity: Number(score.toFixed(2)),
        });
      }
    });

    return {
      ...suggestion,
      possibleDuplicate: candidates.length > 0,
      duplicateCandidates: candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 3),
    };
  });
}

export function mergeSuggestionWithCandidate(suggestion, candidate = {}) {
  return {
    ...suggestion,
    title: longerText(suggestion.title, candidate.title),
    description: joinUnique([suggestion.description, candidate.description]),
    assigneeId: suggestion.assigneeId || candidate.assigneeId || null,
    deadline: suggestion.deadline || candidate.deadline || null,
    sourceEvidence: [
      ...(Array.isArray(suggestion.sourceEvidence) ? suggestion.sourceEvidence : []),
      ...(Array.isArray(candidate.sourceEvidence) ? candidate.sourceEvidence : []),
    ],
    possibleDuplicate: false,
    duplicateCandidates: [],
    duplicateResolution: 'merged',
  };
}

export function getTaskSimilarity(a = {}, b = {}) {
  const aTokens = tokenize(`${a.title || ''} ${a.description || ''}`);
  const bTokens = tokenize(`${b.title || ''} ${b.description || ''}`);
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return intersection / union;
}

function tokenize(value) {
  return new Set(
    String(value)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function longerText(a = '', b = '') {
  return String(a).length >= String(b).length ? a : b;
}

function joinUnique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()))].join('\n\n');
}
