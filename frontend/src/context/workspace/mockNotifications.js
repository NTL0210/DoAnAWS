export function createInitialAiNotifications(now = new Date().toISOString()) {
  return [
    {
      id: 'ntf-ai-processed-demo',
      type: 'AI_PROCESSED',
      title: 'AI processed meeting completed',
      message: 'Sprint Planning Meeting is ready for manager review.',
      isRead: false,
      createdAt: now,
      workspaceId: 'ws-1',
    },
    {
      id: 'ntf-overdue-demo',
      type: 'TASK_OVERDUE',
      title: 'Task overdue',
      message: 'Review overdue tasks before the next standup.',
      isRead: false,
      createdAt: now,
      workspaceId: 'ws-1',
    },
    {
      id: 'ntf-deadline-demo',
      type: 'TASK_DEADLINE_SOON',
      title: 'Task deadline coming soon',
      message: 'A workspace task is due soon.',
      isRead: false,
      createdAt: now,
      workspaceId: 'ws-1',
    },
    {
      id: 'ntf-team-message-demo',
      type: 'TEAM_MESSAGE',
      title: 'New team message',
      message: 'A new message was posted in a team chat.',
      isRead: true,
      createdAt: now,
      workspaceId: 'ws-1',
    },
  ];
}
