const DAY_MS = 24 * 60 * 60 * 1000;

export function isOverdue(date) {
  if (!date) return false;
  const target = startOfDay(date);
  if (!target) return false;
  return target.getTime() < startOfDay(new Date()).getTime();
}

export function isDueSoon(date, withinDays = 2) {
  if (!date || isOverdue(date)) return false;
  const target = startOfDay(date);
  if (!target) return false;
  const diff = target.getTime() - startOfDay(new Date()).getTime();
  return diff <= withinDays * DAY_MS;
}

export function getDeadlineLabel(date) {
  if (!date) return 'No deadline';
  if (isOverdue(date)) return 'Overdue';
  const target = startOfDay(date);
  if (!target) return 'Invalid deadline';
  const today = startOfDay(new Date());
  const diffDays = Math.round((target.getTime() - today.getTime()) / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDeadlineWarning(date) {
  if (!date) return { key: 'missing', label: 'No deadline detected', tone: 'amber' };
  if (isOverdue(date)) return { key: 'overdue', label: 'Deadline is already overdue', tone: 'red' };
  if (isDueSoon(date)) return { key: 'soon', label: 'Deadline is very soon', tone: 'amber' };
  return null;
}

export function getQuickDeadline(option) {
  const date = startOfDay(new Date());
  if (option === 'today') return toDateInput(date);
  if (option === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    return toDateInput(date);
  }
  if (option === 'this-friday') {
    const day = date.getDay();
    const daysUntilFriday = (5 - day + 7) % 7;
    date.setDate(date.getDate() + daysUntilFriday);
    return toDateInput(date);
  }
  if (option === 'next-week') {
    date.setDate(date.getDate() + 7);
    return toDateInput(date);
  }
  return '';
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}
