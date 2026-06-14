/**
 * Default roles, permissions, and labels
 * Extracted from src/lib/workspaceData.js
 */

/** @type {Object<string, {name: string, description: string, permissions: string[], color: string, isSystem: boolean}>} */
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

/** @type {Object<string, string>} */
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

/**
 * Get default permissions for a built-in role
 * @param {string} role
 * @returns {string[]}
 */
export function getDefaultPermissionsForRole(role) {
  const roleDef = DEFAULT_ROLES[role];
  return roleDef ? [...roleDef.permissions] : [];
}
