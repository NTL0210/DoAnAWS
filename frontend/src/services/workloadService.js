export const DEFAULT_WORKLOAD_THRESHOLD = 5;

export function getMemberWorkload(tasks = [], members = [], threshold = DEFAULT_WORKLOAD_THRESHOLD) {
  const activeStatuses = new Set(['TODO', 'IN_PROGRESS', 'REVIEW']);
  return members.map((member) => {
    const activeTasks = tasks.filter((task) =>
      !task.deletedAt
      && !task.archivedAt
      && task.assigneeId === member.userId
      && activeStatuses.has(task.status)
    );
    const overdueTasks = activeTasks.filter((task) => task.deadline && new Date(task.deadline) < new Date());
    return {
      userId: member.userId,
      name: member.name || member.nickname || member.userId,
      activeCount: activeTasks.length,
      overdueCount: overdueTasks.length,
      overloaded: activeTasks.length >= threshold,
    };
  });
}

export function getWorkloadForMember(tasks = [], memberId, threshold = DEFAULT_WORKLOAD_THRESHOLD) {
  return getMemberWorkload(tasks, [{ userId: memberId }], threshold)[0] || {
    userId: memberId,
    activeCount: 0,
    overdueCount: 0,
    overloaded: false,
  };
}
