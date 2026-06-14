/**
 * Default channels and channel sections
 * Extracted from src/lib/workspaceData.js
 */

/** @type {Array<{name: string, type: string, description: string, isDefault: boolean}>} */
export const DEFAULT_TEXT_CHANNELS = [
  { name: 'general', type: 'text', description: 'General discussion for the team', isDefault: true },
  { name: 'announcements', type: 'text', description: 'Important announcements', isDefault: true },
  { name: 'meeting-notes', type: 'text', description: 'Meeting notes and summaries', isDefault: false },
  { name: 'task-updates', type: 'text', description: 'Task progress and updates', isDefault: false },
];

/** @type {Array<Object>} */
export const DEFAULT_VOICE_CHANNELS = [
  {
    name: 'General Voice',
    type: 'voice',
    scope: 'WORKSPACE',
    teamId: null,
    allowedTeamIds: [],
    allowedUserIds: [],
    deniedUserIds: [],
    isDefault: true,
    isLocked: false,
    allowRecording: true,
  },
];

/** @type {Array<{key: string, label: string, type: string}>} */
export const CHANNEL_SECTIONS = [
  { key: 'text', label: 'Text Channels', type: 'text' },
  { key: 'voice', label: 'Voice Channels', type: 'voice' },
];
