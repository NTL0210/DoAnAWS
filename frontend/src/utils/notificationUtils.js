const IMPORTANT_TYPE_PARTS = [
  'TASK',
  'DEADLINE',
  'INVITATION',
  'MEETING',
  'REVIEW',
  'APPROVAL',
  'WORKSPACE_ROLE',
];

export function isImportantNotification(notification) {
  const type = String(notification?.type || '').toUpperCase();
  return IMPORTANT_TYPE_PARTS.some((part) => type.includes(part));
}

export function sanitizeNotificationText(value, fallback = '') {
  return String(value || fallback)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '')
    .replace(/\b(?:task|meeting|workspace|team|user|ntf)-[a-z0-9-]{8,}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .trim();
}
