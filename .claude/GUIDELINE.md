
## How To Navigate This Project

DO NOT scan the entire repository.

Find the feature first.

Only inspect related files.

---

# Theme

Purpose:
Light/Dark mode.

Search Order:

1. animated-theme-toggler.jsx
2. ThemeProvider
3. AppLayout
4. Login layout

Common Issues:

* duplicated theme state
* multiple ThemeProviders
* missing persistence

Never rewrite theme system.

---

# Billing

Purpose:
Quota and subscription management.

Search Order:

1. pricingPlans.js
2. billingService.js
3. WorkspaceBillingPanel.jsx
4. WorkspaceSettingsView.jsx
5. WorkspaceContext.jsx

Common Issues:

* hard-blocking
* downgrade validation
* quota mismatch

Do not modify unrelated workspace logic.

---

# Teams

Purpose:
Workspace organization.

Search Order:

1. WorkspaceContext.jsx
2. CreateTeamModal.jsx
3. Team components

Common Issues:

* plan restrictions
* stale workspace state

---

# Meetings

Purpose:
Meeting lifecycle.

Workflow:

Upload
↓
Transcript
↓
AI Review
↓
Summary
↓
Action Items

Search Order:

Meeting upload components
Meeting services
AI extraction services

---

# Tasks

Purpose:
Convert meeting outputs into execution.

Workflow:

Action Items
↓
Task Generation
↓
Assignment
↓
Tracking

Search Order:

Task pages
Task services
Analytics

---

# Voice

Purpose:
Real-time communication.

Architecture:
Discord-inspired.

Common Issues:

* mic state
* recording
* peer sync
* session mismatch

Do not redesign transport layer.

---

# Authentication

Search Order:

Login
Auth Context
Session Provider

Never break session persistence.

---

# UI Safety Rules

Do not redesign.

Do not replace Tailwind.

Do not introduce another design system.

Do not change spacing unless requested.

Reuse existing components.

---

# If Unsure

Stop.

Document findings.

Ask for clarification.

Do not guess.
