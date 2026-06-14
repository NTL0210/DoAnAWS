/**
 * Seed data: Workspaces and workspace-related mock data
 * Extracted from src/lib/workspaceData.js
 * This file serves as the seed source for mock repositories.
 */

import { DEFAULT_FEATURES } from '@/data/defaults/features';

/**
 * Default workspace channels (both text and voice)
 * @type {Array<Object>}
 */
export const defaultChannels = [
  {
    id: 'ch-general', name: 'general', type: 'text', description: 'General discussion', isDefault: true,
  },
  {
    id: 'ch-announcements', name: 'announcements', type: 'text', description: 'Company announcements', isDefault: true,
  },
  {
    id: 'ch-meeting-notes', name: 'meeting-notes', type: 'text', description: 'Meeting notes', isDefault: false,
  },
  {
    id: 'ch-dev', name: 'development', type: 'text', description: 'Development team chat',
  },
  {
    id: 'ch-marketing', name: 'marketing', type: 'text', description: 'Marketing discussions',
  },
  {
    id: 'vc-general',
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
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'vc-engineering',
    name: 'Engineering Voice',
    type: 'voice',
    scope: 'TEAM',
    teamId: 'team-3',
    allowedTeamIds: ['team-3'],
    allowedUserIds: [],
    deniedUserIds: [],
    isDefault: false,
    isLocked: true,
    allowRecording: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'vc-project-alpha',
    name: 'Project Alpha Voice',
    type: 'voice',
    scope: 'CUSTOM',
    teamId: null,
    allowedTeamIds: ['team-2', 'team-3'],
    allowedUserIds: [],
    deniedUserIds: [],
    isDefault: false,
    isLocked: true,
    allowRecording: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
];

/**
 * Default workspace teams
 * @type {Array<Object>}
 */
export const defaultTeams = [
  { id: 'team-1', name: 'General Team', description: 'Cross-functional team', color: '#5865F2', managerId: 'user-1', memberIds: ['user-1', 'user-2', 'user-3'] },
  { id: 'team-2', name: 'Product Team', description: 'Product development', color: '#3BA55D', managerId: 'user-2', memberIds: ['user-2'] },
  { id: 'team-3', name: 'Engineering Team', description: 'Engineering', color: '#FF8C00', managerId: 'user-1', memberIds: ['user-1', 'user-3'] },
];

/**
 * Mock workspaces
 * @type {Array<Object>}
 */
export const workspaces = [
  {
    id: 'ws-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    ownerId: 'user-1',
    channels: [...defaultChannels],
    teams: [...defaultTeams],
    members: [
      { userId: 'user-1', role: 'OWNER', joinedAt: '2026-01-01T00:00:00Z', nickname: null },
      { userId: 'user-2', role: 'MANAGER', joinedAt: '2026-01-02T00:00:00Z', nickname: null },
      { userId: 'user-3', role: 'EMPLOYEE', joinedAt: '2026-01-03T00:00:00Z', nickname: null },
    ],
    customRoles: [],
    features: [...DEFAULT_FEATURES.map((f) => ({ ...f }))],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
  {
    id: 'ws-2',
    name: 'Design Studio',
    slug: 'design-studio',
    ownerId: 'user-2',
    channels: [
      { id: 'ch-general-2', name: 'general', type: 'text', description: 'General', isDefault: true },
      { id: 'ch-announce-2', name: 'announcements', type: 'text', description: 'Announcements', isDefault: true },
    ],
    teams: [
      { id: 'team-ds-1', name: 'Design Team', description: 'Core design team', color: '#3BA55D', managerId: 'user-2', memberIds: ['user-2'] },
    ],
    members: [
      { userId: 'user-2', role: 'OWNER', joinedAt: '2026-03-01T00:00:00Z', nickname: null },
    ],
    customRoles: [],
    features: [...DEFAULT_FEATURES.map((f) => ({ ...f }))],
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
];

/**
 * User-to-workspace membership mapping
 * @type {Object<string, string[]>}
 */
export const userWorkspaces = {
  'user-1': ['ws-1'],
  'user-2': ['ws-1', 'ws-2'],
  'user-3': ['ws-1'],
};

export default workspaces;
