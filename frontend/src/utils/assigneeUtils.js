export function resolveSuggestedTaskAssignee(task, members = [], selfUserId = null) {
  if (!task || task.assigneeId) return task;

  const rawAssignee = String(task.assignee || '').trim();
  const normalizedAssignee = normalizePersonName(rawAssignee);
  if (!normalizedAssignee) return task;

  if (normalizedAssignee === 'self' && selfUserId) {
    return { ...task, assigneeId: selfUserId };
  }

  const matches = members.filter((member) => {
    const variants = [
      member.name,
      member.nickname,
      typeof member.email === 'string' ? member.email.split('@')[0] : '',
    ].map(normalizePersonName).filter(Boolean);

    return variants.some((variant) => (
      variant === normalizedAssignee ||
      variant.split(' ').includes(normalizedAssignee)
    ));
  });

  const uniqueUserIds = [...new Set(matches.map((member) => member.userId).filter(Boolean))];
  return uniqueUserIds.length === 1
    ? { ...task, assigneeId: uniqueUserIds[0] }
    : task;
}

export function resolveSuggestedTaskAssignees(tasks = [], members = [], selfUserId = null) {
  return tasks.map((task) => resolveSuggestedTaskAssignee(task, members, selfUserId));
}

function normalizePersonName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/^(anh|chi|chị|ban|bạn)\s+/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
