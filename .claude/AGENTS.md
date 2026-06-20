# AI Meeting Workforce Platform

# Ponytail Layer

Before writing code:

1. Does this need to exist?
2. Can existing code solve it?
3. Can browser APIs solve it?
4. Can installed dependencies solve it?
5. Can it be one line?
6. Only then create new code.

Prefer:

- deletion over addition
- reuse over rewrite
- native APIs over dependencies

Never sacrifice:

- security
- validation
- accessibility
- error handling

## Project Identity

Project Name: AI Meeting Workforce Platform

Product Positioning:

This is NOT an AI note-taking clone.

This product transforms meetings into execution.

Workflow:

Meeting
→ Transcript
→ AI Review
→ Summary
→ Action Items
→ Task Creation
→ Workspace Management
→ Execution Tracking
→ Governance & Billing

Primary Goal:

Help teams convert meeting discussions into measurable execution.

---

## Technology Stack

Frontend

* React
* Next.js (Pages Router)
* JavaScript (frontend)
* TypeScript (backend)
* Context API
* TailwindCSS
* Framer Motion

Backend

* Node.js
* Express

Authentication

* Cognito JWT (production)
* JWT mock (development, localStorage-based)
* Role-Based Access Control (ADMIN / MANAGER / EMPLOYEE)

Voice

* Discord-like Voice Architecture

Billing

* Free Pilot
* Business Ops
* Enterprise Governance

---

## Core Engineering Philosophy

Before writing code:

1. Does this need to exist?
2. Can existing code already solve it?
3. Can browser native APIs solve it?
4. Can current dependencies solve it?
5. Can it be implemented simpler?
6. Only then create new code.

Prefer:

* Reuse over rewrite
* Existing services over new services
* Existing contexts over new contexts
* Native APIs over new dependencies
* Simplicity over abstraction
* Deletion over addition

Avoid:

* Over-engineering
* Duplicate logic
* Duplicate hooks
* Duplicate services
* Duplicate utilities
* Premature optimization
* Unnecessary wrappers
* Unnecessary abstractions

---

## Golden Rules

DO NOT rewrite existing UI.

DO NOT redesign components.

DO NOT replace architecture without strong reason.

DO NOT remove animations.

DO NOT introduce new state management libraries.

DO NOT create new services if an existing one can be extended.

DO NOT create duplicate hooks or utilities.

Reuse existing contexts and services whenever possible.

Preserve backward compatibility.

---

## Dependency Rules

Before installing any dependency:

1. Check browser APIs.
2. Check Node.js built-in modules.
3. Check existing dependencies.
4. Explain why installation is required.

Prefer:

* Native APIs
* Existing dependencies

Avoid:

* Convenience libraries
* Wrapper libraries
* Large UI frameworks
* New state management libraries

unless absolutely necessary.

---

## Cache & Storage Rules

Target:

* Keep project lightweight.
* Keep cache under control.
* Minimize unnecessary build artifacts.

Regularly audit:

* node_modules
* dist
* build
* coverage
* logs
* temp
* cache folders

Avoid:

* Storing generated files unnecessarily
* Committing build outputs
* Committing cache directories

Always prefer cleanup before introducing new tooling.

---

## Before Modifying Anything

1. Identify root cause.
2. Trace data flow.
3. Find existing implementation.
4. Reuse before creating new code.
5. Verify affected screens.
6. Check backward compatibility.

Never guess.

---

## Required Output

Before editing:

* Root cause analysis
* Files affected
* Implementation plan

After editing:

* Exact changes
* Verification checklist
* Risks
* Rollback strategy

---

## Verification Checklist

Run:

* npm run lint
* npm run build

Verify:

* No console errors
* Existing UI unchanged
* Existing functionality preserved
* Session persistence verified

---

## Features That Must Never Break

* Authentication
* Workspace
* Meetings
* Voice
* Tasks
* Billing
* Theme
* Navigation
* Analytics

---

## Voice System Rules

Voice behavior should remain Discord-like.

Before modifying voice:

1. Trace microphone flow.
2. Trace recording flow.
3. Trace playback flow.
4. Trace websocket flow.

Never rewrite the voice pipeline without proving root cause.

---

## Performance Rules

Optimize:

* Bundle size
* Memory usage
* Cache usage
* Rendering performance

Do not sacrifice:

* Stability
* Readability
* Maintainability

Prefer measured improvements over assumptions.

---

## Response Style

Always:

* Explain reasoning.
* Show affected files.
* Show risks.
* Show rollback strategy.

Never assume implementation details.

Inspect code before proposing changes.
