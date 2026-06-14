# Data Layer Refactoring Report

## Overview

This report documents the completed refactoring of the AI Meeting & Workforce Platform's data layer. The goal was to separate UI, business logic, and data access into clean architectural layers — preparing the codebase for a future migration from mock data to a real NoSQL database (MongoDB, Firebase, or Supabase) without changing any UI code.

## Architecture

```
┌─────────────────────────────────────────┐
│            UI Layer (Pages/Components)   │
│   No direct imports of mockData.js      │
│   Only imports services or legacyData   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Service Layer                  │
│   permissionService / teamService       │
│   channelService / messageService       │
│   userService / notificationService     │
│   analyticsService / voiceService       │
│   workspaceService / taskService        │
│   legacyDataService (backward compat)   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       Repository Layer                  │
│   Repository Interfaces (JSDoc)         │
│   Mock Implementations                  │
│   Repository Factory (env-based switch) │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         Data Sources                    │
│   Seed Data (src/data/seed/)            │
│   Defaults (src/data/defaults/)         │
│   Legacy mockData.js (unchanged)        │
└─────────────────────────────────────────┘
```

## Files Created (44 new files)

### Domain Models (`src/domain/models/`)

| File | Purpose |
|------|---------|
| Task.js | Task entity + constants (statuses, priorities) + validation |
| Workspace.js | Workspace entity + roles + factory |
| Channel.js | Channel entity + types + factory |
| Meeting.js | Meeting entity + statuses + factory |
| User.js | User entity + factory |
| Team.js | Team entity + factory |
| Message.js | Message entity + attachment typedef + factory |
| Notification.js | Notification entity + factory |
| Invitation.js | Invitation entity + statuses + factory |
| VoiceSession.js | Voice participant + recording typedefs + factory |

### Data Defaults (`src/data/defaults/`)

| File | Purpose |
|------|---------|
| roles.js | DEFAULT_ROLES, PERMISSION_LABELS, getDefaultPermissionsForRole |
| channels.js | DEFAULT_TEXT_CHANNELS, DEFAULT_VOICE_CHANNELS, CHANNEL_SECTIONS |
| teams.js | DEFAULT_TEAMS |
| features.js | DEFAULT_FEATURES |
| views.js | SPECIAL_VIEWS |

### Seed Data (`src/data/seed/`)

| File | Purpose |
|------|---------|
| workspaces.js | Seed workspaces (Acme Corp, Design Studio) + channels, teams, members |
| users.js | 3 mock users (Alex, Sarah, John) |
| meetings.js | 1 mock AI workspace meeting with suggestedTasks |
| tasks.js | 10 mock tasks across departments |
| messages.js | Channel messages for general, dev, marketing, announcements |
| invitations.js | 2 mock invitations |
| notifications.js | 3 mock notifications |

### Repository Interfaces (`src/repositories/interfaces/`)

Each interface is documented via JSDoc showing the contract methods:

- workspaceRepository.js
- taskRepository.js
- meetingRepository.js
- userRepository.js
- teamRepository.js
- channelRepository.js
- messageRepository.js
- notificationRepository.js
- voiceRepository.js

### Mock Repository Implementations (`src/repositories/mock/`)

- mockWorkspaceRepository.js
- mockTaskRepository.js
- mockUserRepository.js
- mockMeetingRepository.js
- mockTeamRepository.js
- mockChannelRepository.js
- mockMessageRepository.js
- mockNotificationRepository.js
- mockVoiceRepository.js

### Repository Factory (`src/repositories/index.js`)

Switches between mock and future MongoDB implementations based on `NEXT_PUBLIC_DATA_PROVIDER` env var.

### Service Layer (`src/services/`)

| File | Purpose |
|------|---------|
| permissionService.js | Workspace-scoped RBAC (getWorkspaceRole, hasWorkspacePermission, etc.) |
| workspaceService.js | Workspace CRUD, slug generation, default structure creation |
| teamService.js | Team CRUD, member management |
| channelService.js | Channel CRUD |
| messageService.js | Message sending, channel messages, team chat |
| userService.js | Login, registration, user lookup |
| notificationService.js | Notification CRUD, unread counts |
| analyticsService.js | Workspace analytics, member workload |
| voiceService.js | Voice recording and upload management |
| taskService.js | Task operations linked with workspaceService |
| legacyDataService.js | Async wrapper for backward compat with old mockData.js |

### API Routes (`pages/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| /api/auth/login | POST | Authenticate user, return JWT |
| /api/auth/me | GET | Get current user profile |
| /api/users | GET/POST | List/create users (admin) |
| /api/users/[id] | GET | Get user by ID |
| /api/tasks | GET/POST | List/create tasks |
| /api/tasks/[id] | GET/PATCH/DELETE | Read/update/delete task |
| /api/meetings | GET/POST | List/upload meetings |
| /api/meetings/[id] | GET/POST | Meeting detail / trigger AI processing |
| /api/workspaces | GET/POST | List/create workspaces |
| /api/workspaces/[id]/teams | GET/POST | List/create teams in workspace |
| /api/notifications | GET/PATCH | List notifications / mark all read |
| /api/notifications/[id] | PATCH | Mark single notification read |
| /api/dashboard/admin | GET | Company-wide analytics |
| /api/dashboard/manager | GET | Department analytics |
| /api/dashboard/employee | GET | Personal task overview |

### Middleware (`pages/api/middleware/`)

| File | Purpose |
|------|---------|
| withAuth.js | JWT verification + role-based authorization |
| withValidation.js | Request body/query/params validation against schemas |

## Files Modified (6 existing files)

| File | Change |
|------|--------|
| src/services/workspaceService.js | Added createWorkspace, getWorkspacesForUser, etc. |
| src/services/taskService.js | Changed import from workspaceData to workspaceService |
| src/services/adapters/mockMeetingAdapter.js | Changed import from workspaceData to workspaceService |
| src/services/adapters/mockVoiceRecordingAdapter.js | Changed import from workspaceData to workspaceService |
| src/context/WorkspaceContext.jsx | Migrated to use new services + repository |
| src/lib/auth.js | Changed import from mockData to legacyDataService |

## Pages/Components Fixed (13 files)

All pages that dynamically imported `../../src/lib/mockData.js` were updated to use `src/services/legacyDataService.js`:

**Admin:** dashboard, users, tasks, departments, analytics
**Manager:** dashboard, tasks, employees, analytics
**Employee:** dashboard, tasks, meetings/[id]
**Components:** UploadMeetingForm, MeetingDetail, TaskList

## Key Design Decisions

### 1. Workspace-Scoped Multi-Tenancy

Permissions are checked per-workspace, not globally. A user may be ADMIN in one workspace and MEMBER in another. The `permissionService.js` centralizes all RBAC logic.

### 2. Repository Pattern

All data access goes through repositories. Interfaces are documented via JSDoc. Mock implementations store data in memory with async/Promise wrappers. Switching to MongoDB means implementing the same interface contract.

### 3. Environment-Based Provider Switching

Set `NEXT_PUBLIC_DATA_PROVIDER=mongodb` in `.env` to activate MongoDB repositories (once implemented). Defaults to `mock`.

### 4. Legacy Backward Compatibility

`legacyDataService.js` wraps the old `mockData.js` in async functions, providing migration path without breaking existing code. All existing pages use this wrapper.

### 5. API Routes as Proof of Concept

API routes demonstrate the full architecture pattern: middleware → service → repository. In production, these would replace the current client-side mock data pattern. Routes enforce JWT auth, role-based access, and input validation.

## What Stays Unchanged

- All UI/UX and visual behavior
- WorkspaceContext.jsx public API (components using it don't need changes)
- Recording/PTT/voice settings in VoiceChannelView
- Framer Motion animations and Tailwind styling
- The mock data file itself (`src/lib/mockData.js`) — kept as fallback

## Migration Path to NoSQL

See [BACKEND_MIGRATION_PLAN.md](./BACKEND_MIGRATION_PLAN.md) for the step-by-step migration guide.
