/**
 * Seed data: Channel messages
 * Extracted from src/lib/workspaceData.js
 */

/**
 * Mock messages per channel
 * @type {Object<string, Array<Object>>}
 */
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

export default mockMessages;
