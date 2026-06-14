# Database Design

## Overview

This document describes the database schema design for the AI Meeting & Workforce Platform. The design targets **MongoDB** (document-oriented NoSQL) but the patterns apply to Firebase Firestore or Supabase with minimal changes.

## Design Principles

1. **Access pattern first** — Collections are designed around query patterns, not relational normalization.
2. **Embedded vs. referenced** — Embed data that is always read together; reference data that grows unbounded or is shared.
3. **Workspace-scoped** — All data is scoped to a workspace for multi-tenant isolation.
4. **Soft deletes** — Use `deletedAt: null | Date` instead of physical deletes where applicable.
5. **Timestamps** — Every document has `createdAt` and `updatedAt`.

---

## Collections

### Users

```
users/
  _id: ObjectId
  name: String
  email: String (unique index)
  passwordHash: String
  avatar: String (URL)
  status: "ACTIVE" | "DISABLED"
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ email: 1 }` unique — for login lookups

**Access patterns:**
- Find by email (login)
- Find by ID (profile)

---

### Workspaces

```
workspaces/
  _id: ObjectId
  name: String
  slug: String (unique index)
  description: String
  logo: String (URL)
  ownerId: ObjectId (ref: users)
  settings: {
    allowGuests: Boolean,
    defaultChannel: String,
  }
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ slug: 1 }` unique — URL-friendly workspace lookup

**Access patterns:**
- Find by slug (URL routing)
- List by ownerId (owner's workspaces)

---

### Workspace Members

```
workspace_members/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  userId: ObjectId (ref: users)
  role: "ADMIN" | "MANAGER" | "MEMBER" | "GUEST"
  joinedAt: ISODate
```

**Indexes:**
- `{ workspaceId: 1, userId: 1 }` unique compound — for membership check
- `{ userId: 1 }` — find all workspaces for a user

**Access patterns:**
- Find members by workspaceId (team roster)
- Find workspaces by userId (workspace list)
- Check role for (workspaceId, userId) — permission guard

---

### Teams (Departments)

```
teams/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  name: String
  description: String
  managerId: ObjectId (ref: users)
  memberIds: [ObjectId] (ref: users)
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ workspaceId: 1 }` — teams in a workspace
- `{ managerId: 1 }` — teams managed by a user
- `{ memberIds: 1 }` — teams containing a user

**Access patterns:**
- Find teams by workspaceId (sidebar)
- Find teams by managerId (manager's teams)
- Find teams containing userId (employee's teams)

---

### Channels

```
channels/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  teamId: ObjectId | null (ref: teams)
  name: String
  type: "TEXT" | "VOICE"
  scope: "PUBLIC" | "PRIVATE" | "TEAM"
  description: String
  createdBy: ObjectId (ref: users)
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ workspaceId: 1, type: 1 }` — channels in a workspace by type
- `{ teamId: 1 }` — channels in a team

**Access patterns:**
- Find channels by workspaceId (channel sidebar)
- Find channels by teamId (team channels)

---

### Messages

```
messages/
  _id: ObjectId
  channelId: ObjectId (ref: channels)
  senderId: ObjectId (ref: users)
  content: String
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number,
  }]
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ channelId: 1, createdAt: -1 }` — messages in a channel, newest first
- `{ senderId: 1, createdAt: -1 }` — messages by a user

**Access patterns:**
- Find messages by channelId (channel history), paginated
- Find messages by senderId (user's message history)

---

### Meetings

```
meetings/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  teamId: ObjectId | null (ref: teams)
  title: String
  transcriptText: String
  audioUrl: String | null
  summary: String | null
  status: "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED"
  uploadedBy: ObjectId (ref: users)
  participants: [ObjectId] (ref: users)
  suggestedTasks: [{
    title: String,
    description: String,
    assignee: String,
    deadline: String | null,
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    confidence: Number,
  }]
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ workspaceId: 1, createdAt: -1 }` — meetings in a workspace, newest first
- `{ teamId: 1 }` — meetings in a team
- `{ uploadedBy: 1 }` — meetings uploaded by a user
- `{ status: 1 }` — filter by processing status

**Access patterns:**
- Find meetings by workspaceId (meeting history)
- Find meetings by teamId (team meetings)
- Find meetings by uploadedBy (user's uploads)
- Find meetings by status (processing queue)

---

### Tasks

```
tasks/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  meetingId: ObjectId | null (ref: meetings)
  teamId: ObjectId (ref: teams)
  title: String
  description: String
  assigneeId: ObjectId | null (ref: users)
  createdBy: ObjectId (ref: users)
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE" | "CANCELLED"
  progress: Number (0-100)
  deadline: ISODate | null
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ workspaceId: 1, status: 1 }` — tasks in a workspace by status
- `{ teamId: 1, status: 1 }` — tasks in a team by status
- `{ assigneeId: 1, status: 1 }` — tasks assigned to a user by status
- `{ meetingId: 1 }` — tasks from a meeting
- `{ deadline: 1, status: 1 }` — overdue task detection

**Access patterns:**
- Find tasks by workspaceId + teamId (department task board)
- Find tasks by assigneeId (my tasks)
- Find tasks by meetingId (AI-generated tasks for a meeting)
- Find overdue tasks: `{ deadline: { $lt: new Date() }, status: { $ne: "COMPLETED" } }`

---

### Notifications

```
notifications/
  _id: ObjectId
  userId: ObjectId (ref: users)
  type: "TASK_ASSIGNED" | "TASK_UPDATED" | "MEETING_COMPLETED" | "MENTION"
  title: String
  message: String
  link: String | null
  read: Boolean (default: false)
  createdAt: ISODate
```

**Indexes:**
- `{ userId: 1, read: 1, createdAt: -1 }` — unread notifications for a user, newest first

**Access patterns:**
- Find unread notifications by userId (badge count)
- Find notifications by userId (notification list)
- Mark as read by notificationId

---

### Invitations

```
invitations/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  email: String
  role: "MANAGER" | "MEMBER"
  invitedBy: ObjectId (ref: users)
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED"
  expiresAt: ISODate
  createdAt: ISODate
  updatedAt: ISODate
```

**Indexes:**
- `{ email: 1, status: 1 }` — pending invitations for an email
- `{ workspaceId: 1 }` — invitations by workspace

---

### Voice Sessions

```
voice_sessions/
  _id: ObjectId
  channelId: ObjectId (ref: channels)
  userId: ObjectId (ref: users)
  startedAt: ISODate
  endedAt: ISODate | null
  recordingUrl: String | null
  duration: Number (seconds)
  createdAt: ISODate
```

**Indexes:**
- `{ channelId: 1, startedAt: -1 }` — voice sessions in a channel

---

### Audit Logs

```
audit_logs/
  _id: ObjectId
  workspaceId: ObjectId (ref: workspaces)
  action: String
  performedBy: ObjectId (ref: users)
  targetType: String
  targetId: ObjectId
  details: Object (arbitrary metadata)
  createdAt: ISODate
```

**Indexes:**
- `{ workspaceId: 1, createdAt: -1 }` — audit trail for a workspace
- `{ performedBy: 1 }` — actions by a user
- `{ targetType: 1, targetId: 1 }` — history for a specific entity

---

## Query Patterns Summary

| Use Case | Collection | Query |
|----------|------------|-------|
| Login | users | `findOne({ email })` |
| User's workspaces | workspace_members | `find({ userId }).populate('workspaceId')` |
| Workspace channels | channels | `find({ workspaceId }).sort({ name: 1 })` |
| Channel messages | messages | `find({ channelId }).sort({ createdAt: -1 }).limit(50)` |
| Team tasks | tasks | `find({ teamId, status: { $ne: 'COMPLETED' } }).sort({ deadline: 1 })` |
| My tasks | tasks | `find({ assigneeId, status: { $ne: 'COMPLETED' } }).sort({ deadline: 1 })` |
| Overdue tasks | tasks | `find({ deadline: { $lt: now }, status: { $ne: 'COMPLETED' } })` |
| Meeting history | meetings | `find({ teamId }).sort({ createdAt: -1 }).limit(20)` |
| Unread notifications | notifications | `find({ userId, read: false }).sort({ createdAt: -1 })` |
| Team members | workspace_members | `find({ workspaceId }).populate('userId')` |

## Migration Notes

### From Mock to MongoDB

1. Replace each mock repository with a Mongoose-based implementation following the same interface.
2. The repository factory (`src/repositories/index.js`) switches based on the `NEXT_PUBLIC_DATA_PROVIDER` env variable.
3. Seed scripts should populate MongoDB using the same seed data from `src/data/seed/`.
4. No UI code changes needed — the repository layer is the only thing that changes.

### From Mock to Firebase

1. Same repository interface pattern, but with Firebase SDK instead of Mongoose.
2. Firestore queries may need collection-group indexes for cross-collection queries.
3. `findByAssignee` becomes `collection('tasks').where('assigneeId', '==', userId)`.

### From Mock to Supabase

1. PostgreSQL tables with the same logical structure.
2. Row-Level Security (RLS) replaces the in-memory permission checks.
3. The repository interface remains unchanged; only the implementation differs.
