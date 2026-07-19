export const PERMISSION_LABELS = {
  'workspace.view': 'View workspace',
  'workspace.manage': 'Manage workspace settings',
  'workspace.delete': 'Delete workspace',
  'channels.create': 'Create channels',
  'channels.delete': 'Delete channels',
  'channels.manage': 'Manage channels',
  'members.view': 'View members',
  'members.invite': 'Invite members',
  'members.remove': 'Remove members',
  'roles.manage': 'Manage roles',
  'roles.view': 'View roles',
  'teams.create': 'Create teams',
  'teams.manage': 'Manage teams and membership',
  'teams.delete': 'Delete teams',
  'teams.view': 'View teams',
  'tasks.create': 'Create tasks',
  'tasks.assign': 'Assign tasks',
  'tasks.delete': 'Delete tasks',
  'tasks.manage_all': 'Manage all tasks',
  'tasks.view': 'View tasks',
  'tasks.update_status': 'Start and submit assigned tasks',
  'tasks.comment': 'Comment on tasks',
  'tasks.approve': 'Approve reviewed tasks',
  'meetings.create': 'Create meetings',
  'meetings.record': 'Record meetings',
  'meetings.manage': 'Manage meetings and AI review',
  'meetings.join': 'Join meetings and voice',
  'voice.record': 'Record voice channels',
  'voice.manage': 'Manage voice channels and recordings',
  'chat.send': 'Send messages',
  'chat.upload': 'Upload files and images',
  'analytics.view': 'View analytics',
  'reports.view': 'View reports',
  'profile.view': 'View profiles',
};

export const WORKSPACE_PERMISSION_GROUPS = [
  { id: 'workspace', label: 'Workspace', permissions: ['workspace.view', 'workspace.manage', 'workspace.delete'] },
  { id: 'members', label: 'Members & roles', permissions: ['members.view', 'members.invite', 'members.remove', 'roles.view', 'roles.manage'] },
  { id: 'teams', label: 'Teams & channels', permissions: ['teams.view', 'teams.create', 'teams.manage', 'teams.delete', 'channels.create', 'channels.manage', 'channels.delete'] },
  { id: 'tasks', label: 'Tasks', permissions: ['tasks.view', 'tasks.create', 'tasks.assign', 'tasks.manage_all', 'tasks.update_status', 'tasks.approve', 'tasks.delete', 'tasks.comment'] },
  { id: 'meetings', label: 'Meetings & voice', permissions: ['meetings.join', 'meetings.create', 'meetings.record', 'meetings.manage', 'voice.record', 'voice.manage'] },
  { id: 'communication', label: 'Communication & insights', permissions: ['chat.send', 'chat.upload', 'analytics.view', 'reports.view', 'profile.view'] },
];

export const ALL_WORKSPACE_PERMISSIONS = Object.keys(PERMISSION_LABELS);

const EMPLOYEE_PERMISSIONS = [
  'workspace.view',
  'members.view',
  'teams.view',
  'tasks.view',
  'tasks.update_status',
  'tasks.comment',
  'meetings.join',
  'chat.send',
  'chat.upload',
  'profile.view',
];

export const DEFAULT_ROLES = {
  OWNER: {
    name: 'Owner',
    description: 'Full workspace control',
    permissions: ALL_WORKSPACE_PERMISSIONS,
    color: '#ED4245',
    isSystem: true,
  },
  VICE_ADMIN: {
    name: 'Vice Admin',
    description: 'Workspace administration without deletion',
    permissions: ALL_WORKSPACE_PERMISSIONS.filter((permission) => permission !== 'workspace.delete'),
    color: '#FF8C00',
    isSystem: true,
  },
  MANAGER: {
    name: 'Manager',
    description: 'Team, task, meeting, and reporting operations',
    permissions: [
      ...EMPLOYEE_PERMISSIONS,
      'channels.create',
      'channels.manage',
      'members.invite',
      'teams.create',
      'teams.manage',
      'tasks.create',
      'tasks.assign',
      'tasks.delete',
      'tasks.manage_all',
      'meetings.create',
      'meetings.record',
      'meetings.manage',
      'voice.record',
      'voice.manage',
      'analytics.view',
      'reports.view',
    ],
    color: '#5865F2',
    isSystem: true,
  },
  EMPLOYEE: {
    name: 'Employee',
    description: 'Assigned work, meetings, and team communication',
    permissions: EMPLOYEE_PERMISSIONS,
    color: '#3BA55D',
    isSystem: true,
  },
};

export function getDefaultPermissionsForRole(role) {
  return DEFAULT_ROLES[role] ? [...DEFAULT_ROLES[role].permissions] : [];
}
