import { DEFAULT_ROLES as CURRENT_DEFAULT_ROLES } from '@/data/defaults/roles';

/**
 * Workspace data model for workspace-based SaaS system.
 *
 * Key concepts:
 * - User accounts have no global role
 * - Roles are scoped per workspace (OWNER > VICE_ADMIN > MANAGER > EMPLOYEE)
 * - Each workspace has its own teams, channels, members, and features
 * - Teams replace the old "departments" concept
 */

// ============================================================
// DEFAULT ROLES (extensible — workspace admin can add custom roles)
// ============================================================
export const DEFAULT_ROLES = {
  OWNER: {
    name: 'Owner',
    description: 'Full control over the workspace',
    permissions: [
      'workspace.manage',
      'workspace.delete',
      'channels.create',
      'channels.delete',
      'channels.manage',
      'members.invite',
      'members.remove',
      'roles.manage',
      'teams.create',
      'teams.manage',
      'teams.delete',
      'tasks.create',
      'tasks.assign',
      'tasks.delete',
      'tasks.manage_all',
      'meetings.create',
      'meetings.record',
      'voice.record',
      'meetings.manage',
      'analytics.view',
      'reports.view',
    ],
    color: '#FF5555',
    isSystem: true,
  },
  VICE_ADMIN: {
    name: 'Vice Admin',
    description: 'Assistant workspace administrator',
    permissions: [
      'channels.create',
      'channels.manage',
      'members.invite',
      'members.remove',
      'roles.view',
      'teams.create',
      'teams.manage',
      'tasks.create',
      'tasks.assign',
      'tasks.manage_all',
      'meetings.create',
      'meetings.record',
      'voice.record',
      'analytics.view',
      'reports.view',
    ],
    color: '#FF8C00',
    isSystem: true,
  },
  MANAGER: {
    name: 'Manager',
    description: 'Manages tasks, meetings, and team progress',
    permissions: [
      'teams.view',
      'tasks.create',
      'tasks.assign',
      'meetings.create',
      'meetings.record',
      'voice.record',
      'analytics.view',
      'reports.view',
    ],
    color: '#5865F2',
    isSystem: true,
  },
  EMPLOYEE: {
    name: 'Employee',
    description: 'Team member who receives tasks and joins meetings',
    permissions: [
      'chat.send',
      'chat.upload',
      'meetings.join',
      'tasks.view',
      'tasks.update_status',
      'tasks.comment',
      'profile.view',
    ],
    color: '#3BA55D',
    isSystem: true,
  },
};

// ============================================================
// PERMISSION LABELS (for display)
// ============================================================
export const PERMISSION_LABELS = {
  'workspace.manage': 'Manage Workspace Settings',
  'workspace.delete': 'Delete Workspace',
  'channels.create': 'Create Channels',
  'channels.delete': 'Delete Channels',
  'channels.manage': 'Manage Channel Settings',
  'members.invite': 'Invite Members',
  'members.remove': 'Remove Members',
  'roles.manage': 'Manage Roles & Permissions',
  'roles.view': 'View Roles',
  'teams.create': 'Create Teams',
  'teams.manage': 'Manage Teams',
  'teams.delete': 'Delete Teams',
  'teams.view': 'View Teams',
  'tasks.create': 'Create Tasks',
  'tasks.assign': 'Assign Tasks',
  'tasks.delete': 'Delete Tasks',
  'tasks.manage_all': 'Manage All Tasks',
  'tasks.view': 'View Tasks',
  'tasks.update_status': 'Update Task Status',
  'tasks.comment': 'Comment on Tasks',
  'meetings.create': 'Create Meetings',
  'meetings.record': 'Record Meetings',
  'voice.record': 'Record Voice Channels',
  'meetings.manage': 'Manage Meetings',
  'meetings.join': 'Join Voice Channels',
  'chat.send': 'Send Messages',
  'chat.upload': 'Upload Files & Images',
  'analytics.view': 'View Analytics',
  'reports.view': 'View Reports',
  'profile.view': 'View Profile',
};

// ============================================================
// DEFAULT CHANNELS for new workspaces
// ============================================================
export const DEFAULT_TEXT_CHANNELS = [
  { name: 'general', type: 'text', description: 'General discussion for the team', isDefault: true },
  { name: 'announcements', type: 'text', description: 'Important announcements', isDefault: true },
  { name: 'meeting-notes', type: 'text', description: 'Meeting notes and summaries', isDefault: false },
  { name: 'task-updates', type: 'text', description: 'Task progress and updates', isDefault: false },
];

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

// ============================================================
// DEFAULT TEAMS for new workspaces
// ============================================================
export const DEFAULT_TEAMS = [
  { name: 'General Team', description: 'Cross-functional team handling general tasks', color: '#5865F2' },
  { name: 'Product Team', description: 'Product development and strategy', color: '#3BA55D' },
  { name: 'Engineering Team', description: 'Engineering and technical implementation', color: '#FF8C00' },
];

// ============================================================
// DEFAULT FEATURES
// ============================================================
export const DEFAULT_FEATURES = [
  { id: 'meetings', name: 'Meetings', icon: 'FiUploadCloud', enabled: true },
  { id: 'tasks', name: 'Tasks', icon: 'FiCheckSquare', enabled: true },
  { id: 'analytics', name: 'Analytics', icon: 'FiBarChart2', enabled: true },
  { id: 'members', name: 'Members', icon: 'FiUsers', enabled: true },
  { id: 'teams', name: 'Teams', icon: 'FiBriefcase', enabled: true },
  { id: 'settings', name: 'Settings', icon: 'FiSettings', enabled: true },
];

// ============================================================
// CHANNEL TYPES
// ============================================================
export const CHANNEL_SECTIONS = [
  { key: 'text', label: 'Text Channels', type: 'text' },
  { key: 'voice', label: 'Voice Channels', type: 'voice' },
];

// ============================================================
// SPECIAL VIEWS
// ============================================================
export const SPECIAL_VIEWS = [
  { id: 'home', name: 'Home', icon: 'FiHome' },
  { id: 'tasks', name: 'Tasks', icon: 'FiCheckSquare' },
  { id: 'meetings', name: 'Meetings', icon: 'FiUploadCloud' },
  { id: 'analytics', name: 'Analytics', icon: 'FiBarChart2' },
  { id: 'members', name: 'Members', icon: 'FiUsers' },
  { id: 'teams', name: 'Teams', icon: 'FiBriefcase' },
  { id: 'settings', name: 'Settings', icon: 'FiSettings' },
];

// ============================================================
// HELPERS
// ============================================================

let _idCounter = Date.now();

/**
 * Generate a unique ID
 */
export function generateId() {
  return (++_idCounter).toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Generate a URL-friendly slug from a workspace name
 * @param {string} name
 * @returns {string}
 */
export function generateWorkspaceSlug(name) {
  return String(name || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

/**
 * Get the role of a user in a workspace
 * @param {Object} workspace
 * @param {string} userId
 * @returns {string|null}
 */
export function getWorkspaceRole(workspace, userId) {
  if (!workspace || !userId) return null;
  const member = workspace.members?.find((m) => m.userId === userId);
  return member ? member.role : null;
}

/**
 * Get the role of a user in a workspace by workspace ID
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {string|null}
 */
export function getMemberRole(workspaceId, userId) {
  // Replaced: workspace lookup via bundled data is removed.
  return null;
}

/**
 * Check if a user has a specific permission in a workspace
 * @param {Object} workspace
 * @param {string} userId
 * @param {string} permission
 * @returns {boolean}
 */
export function hasWorkspacePermission(workspace, userId, permission) {
  if (!workspace || !userId) return false;
  const member = workspace.members?.find((m) => m.userId === userId);
  if (!member) return false;

  const roleDef = CURRENT_DEFAULT_ROLES[member.role] || workspace.customRoles?.find((r) => r.id === member.role);
  if (!roleDef) return false;

  if (member.role === 'OWNER') return true;
  return roleDef.permissions.includes(permission);
}

/**
 * Check if a user has a specific permission in a workspace (by ID)
 * @param {string} workspaceId
 * @param {string} userId
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(workspaceId, userId, permission) {
  // Replaced: workspace lookup via bundled data is removed.
  return false;
}

/**
 * Get all permissions for a user in a workspace
 * @param {Object} workspace
 * @param {string} userId
 * @returns {string[]}
 */
export function getUserWorkspacePermissions(workspace, userId) {
  if (!workspace || !userId) return [];
  const member = workspace.members?.find((m) => m.userId === userId);
  if (!member) return [];

  if (member.role === 'OWNER') {
    return Object.values(CURRENT_DEFAULT_ROLES).reduce((acc, role) => {
      return [...acc, ...role.permissions];
    }, []);
  }

  const roleDef = CURRENT_DEFAULT_ROLES[member.role] || workspace.customRoles?.find((r) => r.id === member.role);
  return roleDef ? roleDef.permissions : [];
}

/**
 * Get all permissions for a user by workspace ID
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {string[]}
 */
export function getUserPermissions(workspaceId, userId) {
  // Replaced: workspace lookup via bundled data is removed.
  return [];
}

/**
 * Get teams from a workspace
 * @param {Object} workspace
 * @returns {Array}
 */
export function getWorkspaceTeams(workspace) {
  return workspace?.teams || [];
}

/**
 * Get members from a workspace
 * @param {Object} workspace
 * @returns {Array}
 */
export function getWorkspaceMembers(workspace) {
  return workspace?.members || [];
}

/**
 * Get default permissions for a built-in role
 * @param {string} role
 * @returns {string[]}
 */
export function getDefaultPermissionsForRole(role) {
  const roleDef = CURRENT_DEFAULT_ROLES[role];
  return roleDef ? roleDef.permissions : [];
}

/**
 * Create initial activity for a new workspace
 * @param {string} workspaceId
 * @param {string} userName
 * @returns {Array}
 */
export function createInitialActivity(workspaceId, userName) {
  const now = new Date().toISOString();
  return [
    {
      id: 'act-' + generateId(),
      type: 'workspace_created',
      message: `${userName} created this workspace`,
      userId: null,
      timestamp: now,
    },
  ];
}

export default {
  DEFAULT_ROLES,
  DEFAULT_TEXT_CHANNELS,
  DEFAULT_VOICE_CHANNELS,
  DEFAULT_TEAMS,
  DEFAULT_FEATURES,
  SPECIAL_VIEWS,
  generateId,
  generateWorkspaceSlug,
  getWorkspaceRole,
  getMemberRole,
  hasWorkspacePermission,
  hasPermission,
  getUserWorkspacePermissions,
  getUserPermissions,
  getWorkspaceTeams,
  getWorkspaceMembers,
  getDefaultPermissionsForRole,
  createInitialActivity,
};
