# Frontend / Backend Function Audit

## Current Repo Shape

```text
frontend/  Next.js Pages Router app, JavaScript, mock-first UI
backend/   TypeScript Express API scaffold, mock/DynamoDB provider switch
```

## Immediate Refactor Done

`frontend/src/context/WorkspaceContext.jsx` remains the largest maintenance risk and should be split with very small checkpoints. It still owns the provider state for compatibility.

Cross-cutting helper files already prepared for the WorkspaceContext split:

- `frontend/src/context/workspace/workspaceRoleMeta.js`
  Role labels, colors, and default workspace constants.
- `frontend/src/context/workspace/mockNotifications.js`
  Mock notification seed data.
- `frontend/src/context/workspace/meetingSuggestionUtils.js`
  Suggested-task normalization helper.
- `frontend/src/context/workspace/workspaceContextValue.js`
  Public context value shape returned by `useWorkspace()`.
- `frontend/src/context/workspace/useWorkspaceNotifications.js`
  Notification state/action hook prepared for the next notification refactor.
- `frontend/src/context/workspace/useWorkspaceActivity.js`
  Activity feed state/action hook prepared for the next context split.
- `frontend/src/context/workspace/useWorkspaceOnboarding.js`
  Onboarding state/action hook prepared for the next context split.

Completed safe component splits:

- `frontend/src/components/layout/TopNavigation.jsx`
  Now composes smaller files instead of owning every dropdown/modal:
  `PageTitle.jsx`, `NotificationMenu.jsx`, `InvitationMenu.jsx`, `ProfileMenu.jsx`, `InviteMembersModal.jsx`.
- `frontend/src/components/channels/VoiceChannelView.jsx`
  Modal/formatter helpers moved under `frontend/src/components/channels/voice-channel/`:
  `VoiceSettingsModal.jsx`, `VoicePermissionModal.jsx`, `ConfirmModal.jsx`, `ToggleSwitch.jsx`, `voiceFormatters.js`.

This keeps existing UI imports stable while moving toward smaller files. `WorkspaceContext.jsx` was restored to a known-buildable source-map version after an unsafe regex split attempt; continue it only with small manual extractions.

## Feature Map

| Area | Current Source | Backend/API Needed | Status |
| --- | --- | --- | --- |
| Auth/login | `pages/login.jsx`, `src/services/userService.js`, `pages/api/auth/*` | auth controller/service/repository | Exists in mock, needs hardening |
| Workspace selection/create | `WorkspaceContext.jsx`, workspace components | workspace module | Mock works, backend scaffold pending for full workspace |
| Teams | `WorkspaceContext.jsx`, `WorkspaceTeamsView.jsx`, `pages/api/workspaces/[id]/teams` | team module | Needs API signature audit |
| Channels/messages | `WorkspaceContext.jsx`, channel components | channel/message modules with cursor pagination | Mock works, DynamoDB pattern needed |
| Tasks | `WorkspaceContext.jsx`, `KanbanBoard.jsx`, task services/repos | task module | Backend scaffold exists for `backend/`; frontend API routes still need cleanup |
| Meetings/AI review | meeting components, meeting services/repos | meeting module, AI job/quota | Backend scaffold exists for `backend/`; AI stays capped/mock-first |
| Notifications | `TopNavigation.jsx`, notification service/repo/API | notification module | Service/repo exist, UI should be wired next |
| Voice/recording | `VoiceChannelView.jsx`, voice hooks/services | voice metadata + presigned storage endpoints | Do not deep-refactor WebRTC yet |
| Analytics | analytics services/components | analytics service with light cache | Mock now, backend later |

## Next Safe Splits

1. `WorkspaceContext.jsx`
   Extract action groups into `useWorkspaceAuthActions`, `useWorkspaceNavigationActions`, `useWorkspaceTaskActions`, `useWorkspaceMeetingActions`, `useWorkspaceTeamActions`, `useWorkspaceVoiceActions`. Do this one group at a time and run build after each group.

2. `VoiceChannelView.jsx`
   Extract recording controls, participant list, permission panel adapter, and recording list into separate components/hooks. Modal/helper extraction is done.

3. `TopNavigation.jsx`
   Layout split is done. Next: move notification bell from placeholder dropdown to real notification adapter/service.

4. API routes
   Keep `pages/api/**` thin. Move request parsing/response mapping to server controllers and keep business logic in services.

## Cost Notes

- Keep `NEXT_PUBLIC_APP_MODE=mock` until each module is API-ready.
- Avoid automatic AI processing. Require user action and enforce quota.
- Use DynamoDB Query + pagination; no production Scan paths.
- Store audio/transcript files in S3 through presigned URLs, not API body uploads.
