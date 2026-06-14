/**
 * Repository factory — provides the correct repository implementation
 * based on the current data provider configuration.
 *
 * Server-only: DATA_PROVIDER env var (not NEXT_PUBLIC_*)
 *   DATA_PROVIDER=mock   → uses mock in-memory repositories
 *   DATA_PROVIDER=mongodb → will use MongoDB repositories (future)
 *
 * NEXT_PUBLIC_APP_MODE is for client-side display (mock | production)
 * and MUST NOT be used for repository selection.
 *
 * Components and services should NEVER import mock repositories directly.
 * Always use this factory:
 *
 *   import { taskRepo, workspaceRepo } from '@/repositories';
 */

// Only import mock repos in mock mode or by default
// When adding MongoDB repos, import them conditionally.

import * as mockWorkspace from '@/repositories/mock/mockWorkspaceRepository';
import * as mockTask from '@/repositories/mock/mockTaskRepository';
import * as mockMeeting from '@/repositories/mock/mockMeetingRepository';
import * as mockUser from '@/repositories/mock/mockUserRepository';
import * as mockTeam from '@/repositories/mock/mockTeamRepository';
import * as mockChannel from '@/repositories/mock/mockChannelRepository';
import * as mockMessage from '@/repositories/mock/mockMessageRepository';
import * as mockNotification from '@/repositories/mock/mockNotificationRepository';
import * as mockVoice from '@/repositories/mock/mockVoiceRepository';

/**
 * Get the current data provider name from environment.
 *
 * Uses DATA_PROVIDER (server-only env var), NOT NEXT_PUBLIC_*.
 * NEXT_PUBLIC_* vars leak to the client bundle and must not
 * control database access.
 *
 * @returns {'mock'|'mongodb'}
 */
function getProvider() {
  // Server-side: DATA_PROVIDER env var (not exposed to frontend)
  if (typeof process !== 'undefined' && process.env?.DATA_PROVIDER) {
    return process.env.DATA_PROVIDER === 'mongodb' ? 'mongodb' : 'mock';
  }

  // Allow runtime override via window for testing (dev only)
  if (typeof window !== 'undefined' && window.__DATA_PROVIDER) {
    return window.__DATA_PROVIDER;
  }

  return 'mock';
}

const provider = getProvider();

/**
 * Repository instances.
 *
 * When adding MongoDB support, create a factory function:
 *
 *   if (provider === 'mongodb') {
 *     const { MongoWorkspaceRepository } = await import('@/repositories/mongo/mongoWorkspaceRepository');
 *     workspaceRepo = new MongoWorkspaceRepository();
 *   }
 *
 * For now, all repos are mock in-memory implementations.
 */

/**
 * @type {import('@/repositories/interfaces/workspaceRepository').WorkspaceRepository}
 */
export const workspaceRepo = mockWorkspace;

/**
 * @type {import('@/repositories/interfaces/taskRepository').TaskRepository}
 */
export const taskRepo = mockTask;

/**
 * @type {import('@/repositories/interfaces/meetingRepository').MeetingRepository}
 */
export const meetingRepo = mockMeeting;

/**
 * @type {import('@/repositories/interfaces/userRepository').UserRepository}
 */
export const userRepo = mockUser;

/**
 * @type {import('@/repositories/interfaces/teamRepository').TeamRepository}
 */
export const teamRepo = mockTeam;

/**
 * @type {import('@/repositories/interfaces/channelRepository').ChannelRepository}
 */
export const channelRepo = mockChannel;

/**
 * @type {import('@/repositories/interfaces/messageRepository').MessageRepository}
 */
export const messageRepo = mockMessage;

/**
 * @type {import('@/repositories/interfaces/notificationRepository').NotificationRepository}
 */
export const notificationRepo = mockNotification;

/**
 * @type {import('@/repositories/interfaces/voiceRepository').VoiceRepository}
 */
export const voiceRepo = mockVoice;

export default {
  workspaceRepo,
  taskRepo,
  meetingRepo,
  userRepo,
  teamRepo,
  channelRepo,
  messageRepo,
  notificationRepo,
  voiceRepo,
};
