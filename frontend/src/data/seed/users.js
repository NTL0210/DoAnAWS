/**
 * Seed data: Users
 * Extracted from src/lib/workspaceData.js
 */

/**
 * Mock user accounts
 * Password is '123456' for all demo accounts
 * @type {Array<Object>}
 */
export const mockUsers = [
  {
    id: 'user-1',
    name: 'Alex Johnson',
    email: 'alex@company.com',
    password: '123456',
    avatar: 'https://i.pravatar.cc/150?img=1',
    role: 'ADMIN',
    departmentId: null,
    phone: '+1 555-0101',
    avatarHistory: [
      'https://i.pravatar.cc/150?img=11',
      'https://i.pravatar.cc/150?img=21',
    ],
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Sarah Chen',
    email: 'sarah@company.com',
    password: '123456',
    avatar: 'https://i.pravatar.cc/150?img=2',
    role: 'MANAGER',
    departmentId: null,
    phone: '+1 555-0102',
    avatarHistory: [],
    createdAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'John Doe',
    email: 'john@company.com',
    password: '123456',
    avatar: 'https://i.pravatar.cc/150?img=3',
    role: 'EMPLOYEE',
    departmentId: null,
    phone: '',
    avatarHistory: [],
    createdAt: '2026-01-15T00:00:00Z',
  },
];

export default mockUsers;
