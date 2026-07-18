const DAY_MS = 24 * 60 * 60 * 1000;

export function isOverdue(date) {
  if (!date) return false;
  const target = startOfDay(date);
  if (!target) return false;
  return target.getTime() < startOfDay(new Date()).getTime();
}

export function isDueSoon(date, withinDays = 3) {
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

export function getDeadlineDateLabel(date) {
  if (!date) return 'No deadline';
  const target = startOfDay(date);
  if (!target) return 'No deadline';
  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDeadlineRemainingDays(date) {
  if (!date) return null;
  const target = startOfDay(date);
  if (!target) return null;
  return Math.round((target.getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
}

export function getDeadlineCountdown(date) {
  const days = getDeadlineRemainingDays(date);
  if (days === null) return 'Deadline not set';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export function getDeadlineWarning(date) {
  if (!date) return { key: 'missing', label: 'No deadline detected', tone: 'amber' };
  const countdown = getDeadlineCountdown(date);
  if (isOverdue(date)) return { key: 'overdue', label: countdown, tone: 'red' };
  if (isDueSoon(date, 3)) return { key: 'soon', label: countdown, tone: 'amber' };
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
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split('-').map(Number)
    : null;
  const date = dateOnly
    ? new Date(dateOnly[0], dateOnly[1] - 1, dateOnly[2])
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}
