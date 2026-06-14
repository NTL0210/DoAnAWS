/**
 * Invitation entity
 *
 * @typedef {Object} Invitation
 * @property {string} id
 * @property {string} workspaceId
 * @property {string} workspaceName
 * @property {string} invitedByUserId
 * @property {string} invitedByUserName
 * @property {string} inviteeEmail
 * @property {'OWNER'|'VICE_ADMIN'|'MANAGER'|'EMPLOYEE'} role
 * @property {'PENDING'|'ACCEPTED'|'DECLINED'} status
 * @property {string[]} [teamIds]
 * @property {string} createdAt
 */

export const INVITATION_STATUSES = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
};

/**
 * Create a new Invitation object
 * @param {Object} data
 * @returns {Invitation}
 */
export function createInvitation(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    workspaceId: data.workspaceId,
    workspaceName: data.workspaceName || '',
    invitedByUserId: data.invitedByUserId,
    invitedByUserName: data.invitedByUserName || '',
    inviteeEmail: data.inviteeEmail,
    role: data.role || 'EMPLOYEE',
    status: data.status || INVITATION_STATUSES.PENDING,
    teamIds: data.teamIds || [],
    createdAt: data.createdAt || now,
  };
}
