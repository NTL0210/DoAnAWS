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
// MOCK WORKSPACES
// ============================================================
export const workspaces = [
  {
    id: 'ws-1',
    name: 'Acme Corp',
    slug: 'acme-corp',
    ownerId: 'user-1',
    channels: [
      { id: 'ch-general', name: 'general', type: 'text', description: 'General discussion', isDefault: true },
      { id: 'ch-announcements', name: 'announcements', type: 'text', description: 'Company announcements', isDefault: true },
      { id: 'ch-meeting-notes', name: 'meeting-notes', type: 'text', description: 'Meeting notes', isDefault: false },
      { id: 'ch-dev', name: 'development', type: 'text', description: 'Development team chat' },
      { id: 'ch-marketing', name: 'marketing', type: 'text', description: 'Marketing discussions' },
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
    ],
    teams: [
      { id: 'team-1', name: 'General Team', description: 'Cross-functional team', color: '#5865F2', managerId: 'user-1', memberIds: ['user-1', 'user-2', 'user-3'] },
      { id: 'team-2', name: 'Product Team', description: 'Product development', color: '#3BA55D', managerId: 'user-2', memberIds: ['user-2'] },
      { id: 'team-3', name: 'Engineering Team', description: 'Engineering', color: '#FF8C00', managerId: 'user-1', memberIds: ['user-1', 'user-3'] },
    ],
    members: [
      { userId: 'user-1', role: 'OWNER', joinedAt: '2026-01-01T00:00:00Z', nickname: null },
      { userId: 'user-2', role: 'MANAGER', joinedAt: '2026-01-02T00:00:00Z', nickname: null },
      { userId: 'user-3', role: 'EMPLOYEE', joinedAt: '2026-01-03T00:00:00Z', nickname: null },
    ],
    customRoles: [],
    features: DEFAULT_FEATURES,
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
    features: DEFAULT_FEATURES,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
  },
];

// ============================================================
// MOCK MESSAGES per channel
// ============================================================
export const mockMessages = {
  'ch-general': [
    {
      id: 'msg-1',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: 'Chào mọi người! Chào mừng đến với workspace **Acme Corp** 🎉',
      attachments: [],
      createdAt: '2026-06-01T09:00:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-2',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Chào anh! Rất vui được tham gia. Em đã xem qua các kênh rồi, workspace nhìn chuyên nghiệp quá! 👋',
      attachments: [],
      createdAt: '2026-06-01T09:05:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-3',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-3',
      content: 'Chào mọi người! Em là thành viên mới, mong được học hỏi nhiều từ anh chị ạ. 😊',
      attachments: [],
      createdAt: '2026-06-01T09:10:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-4',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: 'Chào mừng em! Tuần này chúng ta có một số task cần hoàn thành:\n1. Hoàn thiện giao diện login\n2. Setup CI/CD pipeline\n3. Viết API documentation\n\nMọi người xem và phân bổ thời gian nhé!',
      attachments: [],
      createdAt: '2026-06-02T08:00:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-5',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Dạ vâng anh, em sẽ lo phần CI/CD và API documentation ạ. Còn giao diện login để bạn John phụ trách nhé?',
      attachments: [],
      createdAt: '2026-06-02T08:15:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-6',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-3',
      content: 'Em có thể hỗ trợ phần giao diện login ạ. Em đã có kinh nghiệm với React và Tailwind CSS. Anh cho em xin task nhé?',
      attachments: [],
      createdAt: '2026-06-02T08:30:00Z',
      updatedAt: null,
    },
  ],
  'ch-dev': [
    {
      id: 'msg-dev-1',
      channelId: 'ch-dev',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: 'Mọi người ơi, mình cần thảo luận về kiến trúc mới.',
      attachments: [],
      createdAt: '2026-06-03T10:00:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-dev-2',
      channelId: 'ch-dev',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Theo em thấy App Router có support React Server Components và streaming. Nếu có thời gian, em nghĩ nên migrate dần ạ.',
      attachments: [],
      createdAt: '2026-06-03T10:30:00Z',
      updatedAt: null,
    },
  ],
  'ch-marketing': [
    {
      id: 'msg-mkt-1',
      channelId: 'ch-marketing',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Mọi người ơi, tuần này mình cần chuẩn bị content cho blog post về tính năng mới.',
      attachments: [],
      createdAt: '2026-06-04T14:00:00Z',
      updatedAt: null,
    },
  ],
  'ch-announcements': [
    {
      id: 'msg-ann-1',
      channelId: 'ch-announcements',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: '📢 **THÔNG BÁO QUAN TRỌNG**\n\nKể từ tháng 7, công ty sẽ triển khai chính sách làm việc hybrid mới.',
      attachments: [
        { id: 'att-1', name: 'Hybrid_Policy_2026.pdf', type: 'file', size: '245 KB' },
      ],
      createdAt: '2026-06-01T07:00:00Z',
      updatedAt: null,
    },
  ],
  'team-chat-team-1': [
    {
      id: 'msg-team-1',
      teamId: 'team-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: 'Welcome to the General Team chat. Use this space for cross-functional updates.',
      attachments: [],
      createdAt: '2026-06-05T09:00:00Z',
      updatedAt: null,
      scope: 'TEAM',
    },
  ],
  'team-chat-team-2': [
    {
      id: 'msg-team-2',
      teamId: 'team-2',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Product planning notes and roadmap questions can live here.',
      attachments: [],
      createdAt: '2026-06-05T10:00:00Z',
      updatedAt: null,
      scope: 'TEAM',
    },
  ],
  'team-chat-team-3': [
    {
      id: 'msg-team-3',
      teamId: 'team-3',
      workspaceId: 'ws-1',
      userId: 'user-3',
      content: 'Engineering team chat is ready for implementation discussions.',
      attachments: [],
      createdAt: '2026-06-05T11:00:00Z',
      updatedAt: null,
      scope: 'TEAM',
    },
  ],
};

// ============================================================
// MOCK AI MEETINGS
// ============================================================
export const mockWorkspaceMeetings = [
  {
    id: 'meeting-ai-1',
    workspaceId: 'ws-1',
    teamId: 'team-3',
    title: 'AI Meeting Review Flow Kickoff',
    type: 'TRANSCRIPT',
    status: 'AI_REVIEW_READY',
    participants: ['user-1', 'user-3'],
    participantIds: ['user-1', 'user-3'],
    transcript: 'Alex: We need a review step before creating AI tasks. John: I can polish the suggested task card and confidence warnings by Friday.',
    transcriptText: 'Alex: We need a review step before creating AI tasks. John: I can polish the suggested task card and confidence warnings by Friday.',
    audioFile: null,
    storageKey: null,
    aiSummary: 'The team aligned on a manager review flow where AI suggests tasks, managers edit and approve, then tasks are created with meeting traceability.',
    summary: 'The team aligned on a manager review flow where AI suggests tasks, managers edit and approve, then tasks are created with meeting traceability.',
    keyDecisions: [
      'AI must not create tasks without manager approval.',
      'Every created task should keep sourceMeetingId.',
    ],
    risks: [
      'Low confidence suggestions need clear review warnings.',
    ],
    actionItems: [
      'Build suggested task cards with edit controls.',
      'Show generated tasks in meeting detail.',
    ],
    suggestedTasks: [
      {
        id: 'suggestion-ai-1',
        title: 'Build suggested task review cards',
        description: 'Create editable cards for AI suggested tasks with selection, assignee, team, priority, deadline, and confidence.',
        assigneeId: 'user-3',
        teamId: 'team-3',
        priority: 'HIGH',
        deadline: '2026-06-12',
        confidence: 0.88,
        status: 'PENDING_REVIEW',
        approved: true,
        selected: true,
        sourceQuote: 'John: I can polish the suggested task card and confidence warnings by Friday.',
        missingFields: [],
      },
      {
        id: 'suggestion-ai-2',
        title: 'Add low confidence review warning',
        description: 'Display Needs review for confidence lower than 80 percent.',
        assigneeId: null,
        teamId: 'team-3',
        priority: 'MEDIUM',
        deadline: null,
        confidence: 0.72,
        status: 'PENDING_REVIEW',
        approved: false,
        selected: false,
        sourceQuote: 'John: confidence warnings by Friday.',
        missingFields: ['assigneeId', 'deadline'],
      },
    ],
    generatedTaskIds: [],
    processingJobId: 'mock-job-seed-1',
    processingError: null,
    createdBy: 'user-1',
    createdAt: '2026-06-06T09:00:00Z',
    updatedAt: '2026-06-06T09:05:00Z',
  },
];

// ============================================================
// MOCK INVITATIONS
// ============================================================
export const mockInvitations = [
  {
    id: 'inv-1',
    workspaceId: 'ws-1',
    workspaceName: 'Acme Corp',
    invitedByUserId: 'user-1',
    invitedByUserName: 'Alex Johnson',
    inviteeEmail: 'robert@company.com',
    role: 'EMPLOYEE',
    status: 'PENDING',
    createdAt: '2026-06-04T10:00:00Z',
  },
  {
    id: 'inv-2',
    workspaceId: 'ws-2',
    workspaceName: 'Design Studio',
    invitedByUserId: 'user-2',
    invitedByUserName: 'Sarah Chen',
    inviteeEmail: 'john@company.com',
    role: 'MANAGER',
    status: 'PENDING',
    createdAt: '2026-06-04T12:00:00Z',
  },
];

// ============================================================
// USER WORKSPACE MEMBERSHIP
// ============================================================
export const userWorkspaces = {
  'user-1': ['ws-1'],
  'user-2': ['ws-1', 'ws-2'],
  'user-3': ['ws-1'],
};

// ============================================================
// MOCK USERS
// ============================================================
export const mockUsers = [
  {
    id: 'user-1',
    name: 'Alex Johnson',
    email: 'alex@company.com',
    password: '123456',
    avatar: 'https://i.pravatar.cc/150?img=1',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Sarah Chen',
    email: 'sarah@company.com',
    password: '123456',
    avatar: 'https://i.pravatar.cc/150?img=2',
    createdAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'John Doe',
    email: 'john@company.com',
    password: '123456',
    avatar: 'https://i.pravatar.cc/150?img=3',
    createdAt: '2026-01-15T00:00:00Z',
  },
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
  return name
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
  const workspace = workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return null;
  const member = workspace.members?.find((m) => m.userId === userId);
  return member ? member.role : null;
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

  const roleDef = DEFAULT_ROLES[member.role] || workspace.customRoles?.find((r) => r.id === member.role);
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
  const workspace = workspaces.find((w) => w.id === workspaceId);
  return hasWorkspacePermission(workspace, userId, permission);
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
    return Object.values(DEFAULT_ROLES).reduce((acc, role) => {
      return [...acc, ...role.permissions];
    }, []);
  }

  const roleDef = DEFAULT_ROLES[member.role] || workspace.customRoles?.find((r) => r.id === member.role);
  return roleDef ? roleDef.permissions : [];
}

/**
 * Get all permissions for a user by workspace ID
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {string[]}
 */
export function getUserPermissions(workspaceId, userId) {
  const workspace = workspaces.find((w) => w.id === workspaceId);
  return getUserWorkspacePermissions(workspace, userId);
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
  const roleDef = DEFAULT_ROLES[role];
  return roleDef ? roleDef.permissions : [];
}

/**
 * Create a complete default workspace structure
 * @param {string} name
 * @param {string} ownerId
 * @returns {Object}
 */
export function createDefaultWorkspaceStructure(name, ownerId) {
  const wsId = 'ws-' + generateId();
  const slug = generateWorkspaceSlug(name);
  const now = new Date().toISOString();

  // Create channels with unique IDs
  const textChannels = DEFAULT_TEXT_CHANNELS.map((ch, i) => ({
    id: wsId + '-ch-' + i,
    name: ch.name,
    type: 'text',
    description: ch.description,
    isDefault: ch.isDefault,
  }));

  const voiceChannels = DEFAULT_VOICE_CHANNELS.map((ch, i) => ({
    id: wsId + '-vc-' + i,
    name: ch.name,
    type: 'voice',
    scope: ch.scope,
    teamId: ch.teamId,
    allowedTeamIds: ch.allowedTeamIds,
    allowedUserIds: ch.allowedUserIds,
    deniedUserIds: ch.deniedUserIds,
    isDefault: ch.isDefault,
    isLocked: ch.isLocked,
    allowRecording: ch.allowRecording,
    createdAt: now,
    updatedAt: now,
  }));

  // Create default teams with unique IDs
  const teams = DEFAULT_TEAMS.map((team, i) => ({
    id: wsId + '-team-' + i,
    name: team.name,
    description: team.description,
    color: team.color,
    managerId: ownerId,
    memberIds: [ownerId],
    createdAt: now,
    updatedAt: now,
  }));

  return {
    id: wsId,
    name: name.trim(),
    slug,
    ownerId,
    channels: [...textChannels, ...voiceChannels],
    teams,
    members: [
      {
        userId: ownerId,
        role: 'OWNER',
        joinedAt: now,
        nickname: null,
      },
    ],
    customRoles: [],
    features: DEFAULT_FEATURES.map((f) => ({ ...f })),
    createdAt: now,
    updatedAt: now,
  };
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
  workspaces,
  mockMessages,
  mockInvitations,
  mockWorkspaceMeetings,
  userWorkspaces,
  mockUsers,
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
  createDefaultWorkspaceStructure,
  createInitialActivity,
};
