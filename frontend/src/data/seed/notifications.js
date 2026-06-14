/**
 * Seed data: Notifications
 * Extracted from src/lib/mockData.js (notifications array)
 */

/**
 * Mock notifications
 * @type {Array<Object>}
 */
export const mockNotifications = [
  {
    id: 'notif-1',
    userId: 'emp-3',
    title: 'New task assigned',
    message: 'You have been assigned a new task: Implement form validation for login page',
    type: 'task_assigned',
    isRead: false,
    createdAt: '2026-05-21T10:30:00Z',
  },
  {
    id: 'notif-2',
    userId: 'emp-4',
    title: 'Task deadline approaching',
    message: 'Your task "Create reusable input components" is due in 2 days',
    type: 'deadline_approaching',
    isRead: true,
    createdAt: '2026-06-01T14:20:00Z',
  },
  {
    id: 'notif-3',
    userId: 'emp-6',
    title: 'Meeting processed',
    message: 'The API Architecture Review meeting has been processed and 2 tasks have been extracted',
    type: 'meeting_processed',
    isRead: false,
    createdAt: '2026-05-22T09:15:00Z',
  },
];

export default mockNotifications;
