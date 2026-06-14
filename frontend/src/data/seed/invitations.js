/**
 * Seed data: Invitations
 * Extracted from src/lib/workspaceData.js
 */

/**
 * Mock invitations
 * @type {Array<Object>}
 */
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

export default mockInvitations;
