/**
 * AnalyticsService — workspace analytics with caching and date-range filters
 *
 * Key improvements over the previous implementation:
 * - Date range filtering (getWorkspaceAnalytics accepts { dateFrom, dateTo })
 * - In-memory cache with TTL (cleared when data invalidated)
 * - Pagination-ready for large datasets
 * - Task trends over time
 */

import { taskRepo, meetingRepo } from '@/repositories';
import { CACHE_TTL } from '@/domain/constants/costConstants';

// ─── In-memory cache ────────────────────────────────────────────────
/** @type {Map<string, { data: Object, expiresAt: number }>} */
const _cache = new Map();

function _cacheKey(workspaceId, dateFrom, dateTo) {
  return `${workspaceId}|${dateFrom || ''}|${dateTo || ''}`;
}

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function _cacheSet(key, data, ttl = CACHE_TTL.analytics) {
  _cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/**
 * Get workspace analytics with optional date range
 *
 * @param {string} workspaceId
 * @param {Object} [options={}]
 * @param {string} [options.dateFrom] — ISO date string
 * @param {string} [options.dateTo] — ISO date string
 * @param {boolean} [options.forceRefresh=false] — bypass cache
 * @returns {Promise<Object>}
 */
export async function getWorkspaceAnalytics(workspaceId, options = {}) {
  const { dateFrom, dateTo, forceRefresh = false } = options;
  const key = _cacheKey(workspaceId, dateFrom, dateTo);

  // Check cache
  if (!forceRefresh) {
    const cached = _cacheGet(key);
    if (cached) return cached;
  }

  // Fetch data
  const [tasks, meetings] = await Promise.all([
    taskRepo.findByWorkspace(workspaceId),
    meetingRepo.findByWorkspace(workspaceId),
  ]);

  // Apply date range filter if specified
  const filteredTasks = applyDateFilter(tasks, dateFrom, dateTo, 'createdAt');
  const filteredMeetings = applyDateFilter(meetings, dateFrom, dateTo, 'createdAt');

  const analytics = computeAnalytics(filteredTasks, filteredMeetings);

  // Cache result
  _cacheSet(key, analytics, CACHE_TTL.analytics);

  return analytics;
}

/**
 * Get member workload for a workspace
 *
 * @param {string} workspaceId
 * @param {Array} members
 * @param {Object} [options={}]
 * @returns {Promise<Array>}
 */
export async function getMemberWorkload(workspaceId, members, options = {}) {
  const { dateFrom, dateTo } = options;
  const tasks = await taskRepo.findByWorkspace(workspaceId);
  const filtered = applyDateFilter(tasks, dateFrom, dateTo, 'createdAt');

  return (members || []).slice(0, 5).map((member) => {
    const assigned = filtered.filter((t) => t.assigneeId === member.userId);
    const done = assigned.filter((t) => t.status === 'COMPLETED').length;
    const percent = assigned.length ? Math.round((done / assigned.length) * 100) : 0;

    return {
      id: member.userId,
      name: member.name || member.nickname || 'Unknown',
      role: member.role || 'Member',
      assigned: assigned.length,
      completed: done,
      inProgress: assigned.filter((t) => t.status === 'IN_PROGRESS').length,
      overdue: assigned.filter(
        (t) => t.deadline && t.status !== 'COMPLETED' && new Date(t.deadline) < new Date()
      ).length,
      completionRate: percent,
    };
  });
}

/**
 * Get task completion trends over the last N days
 *
 * @param {string} workspaceId
 * @param {number} [days=7]
 * @returns {Promise<Array<{ date: string, completed: number, created: number }>>}
 */
export async function getTaskTrends(workspaceId, days = 7) {
  const tasks = await taskRepo.findByWorkspace(workspaceId);
  const now = new Date();
  const trends = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const created = tasks.filter((t) => {
      const d = new Date(t.createdAt);
      return d >= dayStart && d <= dayEnd;
    }).length;

    const completed = tasks.filter((t) => {
      const d = new Date(t.updatedAt);
      return t.status === 'COMPLETED' && d >= dayStart && d <= dayEnd;
    }).length;

    trends.push({
      date: dayStart.toISOString().slice(0, 10),
      completed,
      created,
    });
  }

  return trends;
}

/**
 * Invalidate analytics cache for a workspace
 *
 * @param {string} workspaceId
 */
export function invalidateAnalyticsCache(workspaceId) {
  // Delete all cache entries for this workspace
  for (const key of _cache.keys()) {
    if (key.startsWith(`${workspaceId}|`)) {
      _cache.delete(key);
    }
  }
}

// ─── Internal helpers ────────────────────────────────────────────────

/**
 * Apply date range filter to an array of items
 *
 * @param {Array} items
 * @param {string|null} dateFrom
 * @param {string|null} dateTo
 * @param {string} dateField — field name to compare
 * @returns {Array}
 */
function applyDateFilter(items, dateFrom, dateTo, dateField) {
  if (!dateFrom && !dateTo) return items;

  return items.filter((item) => {
    const itemDate = new Date(item[dateField]);
    if (dateFrom && itemDate < new Date(dateFrom)) return false;
    if (dateTo && itemDate > new Date(dateTo)) return false;
    return true;
  });
}

/**
 * Compute all analytics from filtered data
 *
 * @param {Array} tasks
 * @param {Array} meetings
 * @returns {Object}
 */
function computeAnalytics(tasks, meetings) {
  const statusCounts = {};
  tasks.forEach((task) => {
    const s = task.status || 'TODO';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const totalTasks = tasks.length;
  const completedTasks = statusCounts.COMPLETED || 0;
  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.deadline && t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && new Date(t.deadline) < now
  ).length;

  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Assignee workload distribution
  const workloadByAssignee = {};
  tasks.forEach((task) => {
    const assignee = task.assigneeId || 'unassigned';
    if (!workloadByAssignee[assignee]) {
      workloadByAssignee[assignee] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
    }
    workloadByAssignee[assignee].total++;
    if (task.status === 'COMPLETED') workloadByAssignee[assignee].completed++;
    else if (task.status === 'IN_PROGRESS') workloadByAssignee[assignee].inProgress++;
    else workloadByAssignee[assignee].pending++;
  });

  // Priority distribution
  const priorityCounts = {};
  tasks.forEach((task) => {
    const p = task.priority || 'MEDIUM';
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;
  });

  // Meeting stats
  const meetingsByStatus = {};
  meetings.forEach((m) => {
    const s = m.status || 'UPLOADED';
    meetingsByStatus[s] = (meetingsByStatus[s] || 0) + 1;
  });

  return {
    tasks: {
      total: totalTasks,
      byStatus: statusCounts,
      byPriority: priorityCounts,
      completed: completedTasks,
      overdue: overdueTasks,
      active: totalTasks - completedTasks - (statusCounts.CANCELLED || 0),
      completionRate,
    },
    workload: workloadByAssignee,
    meetings: {
      total: meetings.length,
      byStatus: meetingsByStatus,
    },
  };
}
