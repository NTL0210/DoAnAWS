/**
 * DynamoDB Single-Table Design — Entity Types & Key Patterns
 *
 * Single table with composite keys (PK/SK) and 2 GSIs.
 * Each entity type uses a prefix pattern for keys.
 *
 * ────────── PK/SK Pattern ──────────
 * Entity        | PK                        | SK
 * ──────────────|───────────────────────────|─────────────────────────
 * USER          | USER#{userId}             | PROFILE#{userId}
 * WORKSPACE     | WS#{workspaceId}          | META#{workspaceId}
 * WS_MEMBER     | WS#{workspaceId}          | MEMBER#{userId}
 * WS_CHANNEL    | WS#{workspaceId}          | CHANNEL#{channelId}
 * WS_TEAM       | WS#{workspaceId}          | TEAM#{teamId}
 * MEETING       | MEETING#{meetingId}       | META#{meetingId}
 * TASK          | TASK#{taskId}             | META#{taskId}
 * NOTIFICATION  | NOTIF#{userId}            | NOTIF#{notifId}
 * INVITATION    | INVITE#{workspaceId}      | INVITE#{inviteId}
 *
 * ────────── GSI1 Pattern ──────────
 * Entity        | GSI1PK                    | GSI1SK
 * ──────────────|───────────────────────────|─────────────────────────
 * USER by email | EMAIL#{email}             | USER#{userId}
 * MEETING by WS | WS#{workspaceId}          | MEETING#{createdAt}
 * TASK by WS    | WS#{workspaceId}          | TASK#{createdAt}
 * TASK by user  | ASSIGNEE#{assigneeId}     | TASK#{deadline}
 *
 * ────────── GSI2 Pattern ──────────
 * Entity        | GSI2PK                    | GSI2SK
 * ──────────────|───────────────────────────|─────────────────────────
 * MEETING status| STATUS#{status}           | MEETING#{createdAt}
 * TASK status   | STATUS#{status}           | TASK#{deadline}
 *
 * @module dynamodb/entityTypes
 */

export const ENTITY = {
  USER: 'USER',
  WORKSPACE: 'WS',
  MEETING: 'MEETING',
  TASK: 'TASK',
  NOTIFICATION: 'NOTIF',
  INVITATION: 'INVITE',
};

export const SORT = {
  PROFILE: 'PROFILE',
  META: 'META',
  MEMBER: 'MEMBER',
  CHANNEL: 'CHANNEL',
  TEAM: 'TEAM',
};

/** Build PK for a given entity type and ID */
export function pk(entity, id) {
  return `${entity}#${id}`;
}

/** Build SK for a given sort prefix and ID */
export function sk(prefix, id) {
  return `${prefix}#${id}`;
}

/** Build GSI1 key */
export function gsi1(pk, sk) {
  return { GSI1PK: pk, GSI1SK: sk };
}

/** Build GSI2 key */
export function gsi2(pk, sk) {
  return { GSI2PK: pk, GSI2SK: sk };
}

export default { ENTITY, SORT, pk, sk, gsi1, gsi2 };
