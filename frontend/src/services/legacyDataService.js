/**
 * LegacyDataService — async wrapper for legacy mockData.js
 *
 * This service provides backward-compatible access to the old
 * department-based mock data for pages that haven't been migrated
 * to the workspace architecture yet.
 *
 * Migration path: When these pages are migrated to use repositories
 * and services directly, this file can be removed.
 *
 * NEVER import @/lib/mockData directly in page/component files.
 * Always use this service instead.
 */

const DELAY_MS = 100;
const delay = (ms = DELAY_MS) => new Promise((r) => setTimeout(r, ms));

/**
 * Load all departments
 * @returns {Promise<Array>}
 */
export async function getDepartments() {
  await delay();
  const { departments } = await import('@/lib/mockData');
  return departments;
}

/**
 * Load all users
 * @returns {Promise<Array>}
 */
export async function getUsers() {
  await delay();
  const { users } = await import('@/lib/mockData');
  return users;
}

/**
 * Load all meetings
 * @returns {Promise<Array>}
 */
export async function getMeetings() {
  await delay();
  const { meetings } = await import('@/lib/mockData');
  return meetings;
}

/**
 * Load all tasks
 * @returns {Promise<Array>}
 */
export async function getTasks() {
  await delay();
  const { tasks } = await import('@/lib/mockData');
  return tasks;
}

/**
 * Load all notifications
 * @returns {Promise<Array>}
 */
export async function getNotifications() {
  await delay();
  const { notifications } = await import('@/lib/mockData');
  return notifications;
}

/**
 * Load all data at once
 * @returns {Promise<{departments: Array, users: Array, meetings: Array, tasks: Array, notifications: Array}>}
 */
export async function getAllData() {
  const [departments, users, meetings, tasks, notifications] = await Promise.all([
    getDepartments(),
    getUsers(),
    getMeetings(),
    getTasks(),
    getNotifications(),
  ]);
  return { departments, users, meetings, tasks, notifications };
}

/**
 * Get mock AI service
 * @returns {Promise<Object>}
 */
export async function getMockAI() {
  await delay();
  const { mockAI } = await import('@/lib/mockData');
  return mockAI;
}

/**
 * Find a user by ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getUserById(id) {
  const users = await getUsers();
  return users.find((u) => u.id === id) || null;
}

/**
 * Find tasks by assignee ID
 * @param {string} assigneeId
 * @returns {Promise<Array>}
 */
export async function getTasksByAssignee(assigneeId) {
  const tasks = await getTasks();
  return tasks.filter((t) => t.assigneeId === assigneeId);
}

/**
 * Find meetings by department
 * @param {string} departmentId
 * @returns {Promise<Array>}
 */
export async function getMeetingsByDepartment(departmentId) {
  const meetings = await getMeetings();
  return meetings.filter((m) => m.departmentId === departmentId);
}

// ─── Re-export new cost-aware services for backward compatibility ───
export {
  requestPresignedUploadUrl,
  uploadFileToStorage,
  requestSignedDownloadUrl,
  deleteStoredFile,
  validateFileBeforeUpload,
  checkFileExists,
  computeFileHash,
} from '@/services/storageService';

export {
  estimateAiCost,
  validateBeforeAiProcessing,
  computeTranscriptHash,
  checkTranscriptChanged,
  clearCache as clearAiCache,
} from '@/services/aiMeetingService';

export {
  getWorkspaceUsage,
  checkAiQuota,
  checkVoiceQuota,
  checkStorageQuota,
  checkJobConcurrency,
  incrementAiRuns,
} from '@/services/quotaService';
