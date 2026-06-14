export function buildMeetingTimeline(meeting = {}, tasks = []) {
  if (Array.isArray(meeting.timeline) && meeting.timeline.length) return meeting.timeline;

  const suggestedTasks = meeting.suggestedTasks || [];
  const relatedTasksByTimestamp = new Map();
  [...suggestedTasks, ...tasks].forEach((task) => {
    const key = task.sourceTimestamp || 'estimated';
    relatedTasksByTimestamp.set(key, [...(relatedTasksByTimestamp.get(key) || []), task]);
  });

  const transcript = meeting.transcriptText || meeting.transcript || '';
  const transcriptLines = transcript.split(/\n+/).filter(Boolean);
  const hasTimestampedTranscript = transcriptLines.some((line) => /^\s*(\d{1,2}:)?\d{1,2}:\d{2}/.test(line));

  const base = [
    { timestamp: '00:00', title: 'Introduction', summary: 'Meeting context, goals, and attendees are established.', speaker: getSpeaker(transcriptLines[0]) },
    { timestamp: '03:20', title: 'Key discussion', summary: meeting.keyDecisions?.[0] || meeting.summary || meeting.aiSummary || 'The team discusses the main topic and constraints.' },
    { timestamp: '08:45', title: 'Action assignment', summary: meeting.actionItems?.[0] || 'Follow-up work is assigned and clarified.' },
    { timestamp: '12:10', title: 'Deadline discussion', summary: 'Timeline, deadline, or review expectations are discussed.' },
  ];

  return base.map((item) => ({
    ...item,
    estimated: !hasTimestampedTranscript,
    relatedTasks: relatedTasksByTimestamp.get(item.timestamp) || [],
  }));
}

export function timestampToSeconds(timestamp) {
  if (!timestamp) return null;
  const parts = String(timestamp).split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function getSpeaker(line = '') {
  const match = String(line).match(/^([^:]{2,40}):/);
  return match?.[1] || null;
}
