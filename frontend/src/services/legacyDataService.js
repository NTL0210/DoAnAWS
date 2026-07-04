/**
 * LegacyDataService — async wrapper for legacy data.
 *
 * In cloud mode, delegates to the cloud API.
 * In non-cloud mode, returns empty arrays (no mock data).
 *
 * NEVER import @/lib/mockData directly — mock data has been removed.
 */

import { isCloudMode } from '@/config/runtimeConfig';
import { meetingsApi, tasksApi, usersApi } from '@/services/cloudClient';

export async function getDepartments() {
  return [];
}

export async function getUsers() {
  if (isCloudMode()) {
    try {
      return await usersApi.list();
    } catch {
      return [];
    }
  }
  return [];
}

export async function getMeetings() {
  if (isCloudMode()) {
    try {
      return await meetingsApi.list({});
    } catch {
      return [];
    }
  }
  return [];
}

export async function getTasks() {
  if (isCloudMode()) {
    try {
      return await tasksApi.list({});
    } catch {
      return [];
    }
  }
  return [];
}

export async function getNotifications() {
  return [];
}

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

export async function getUserById(id) {
  if (isCloudMode()) {
    try {
      return await usersApi.get(id);
    } catch {
      return null;
    }
  }
  return null;
}

export async function getTasksByAssignee(assigneeId) {
  if (isCloudMode()) {
    try {
      return await tasksApi.list({ assigneeId });
    } catch {
      return [];
    }
  }
  return [];
}

export async function getMeetingsByDepartment(departmentId) {
  return [];
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
