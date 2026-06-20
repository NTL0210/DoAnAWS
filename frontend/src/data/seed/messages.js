/**
 * Seed data: channel messages.
 * Extracted from src/lib/workspaceData.js.
 */

/**
 * Mock messages per channel.
 * @type {Object<string, Array<Object>>}
 */
export const mockMessages = {
  'ch-general': [
    {
      id: 'msg-1',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: 'Hi everyone! Welcome to the **Acme Corp** workspace.',
      attachments: [],
      createdAt: '2026-06-01T09:00:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-2',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Hi Alex! Happy to join. I reviewed the channels, and the workspace already feels organized.',
      attachments: [],
      createdAt: '2026-06-01T09:05:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-3',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-3',
      content: 'Hi everyone, I am the new member. Looking forward to learning from the team.',
      attachments: [],
      createdAt: '2026-06-01T09:10:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-4',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-1',
      content: 'Welcome. This week we need to finish:\n1. Polish the login interface\n2. Set up the CI/CD pipeline\n3. Write API documentation\n\nPlease review the list and plan your time.',
      attachments: [],
      createdAt: '2026-06-02T08:00:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-5',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'Got it. I will take CI/CD and API documentation. Can John own the login interface?',
      attachments: [],
      createdAt: '2026-06-02T08:15:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-6',
      channelId: 'ch-general',
      workspaceId: 'ws-1',
      userId: 'user-3',
      content: 'I can help with the login interface. I have React and Tailwind CSS experience. Please assign that task to me.',
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
      content: 'Team, we need to discuss the new architecture.',
      attachments: [],
      createdAt: '2026-06-03T10:00:00Z',
      updatedAt: null,
    },
    {
      id: 'msg-dev-2',
      channelId: 'ch-dev',
      workspaceId: 'ws-1',
      userId: 'user-2',
      content: 'App Router supports React Server Components and streaming. If we have time, we should migrate gradually.',
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
      content: 'Team, this week we need to prepare content for the blog post about the new feature.',
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
      content: '**IMPORTANT ANNOUNCEMENT**\n\nStarting in July, the company will roll out a new hybrid work policy.',
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

export default mockMessages;
