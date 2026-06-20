# AI Meeting Workforce Platform

## Project Identity

Project Name:
AI Meeting Workforce Platform

Product Positioning:

This is NOT an AI note-taking clone.

The platform transforms meetings into execution.

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
* Vite
* JavaScript
* Context API
* TailwindCSS
* Framer Motion

Backend

* Node.js
* Express

Authentication

* Session-based authentication

Voice

* Discord-like voice architecture

Billing

* Free Pilot
* Business Ops
* Enterprise Governance

---

## Core Engineering Philosophy

Before writing code:

1. Does this need to exist?
2. Can existing code solve it?
3. Can native browser APIs solve it?
4. Can current dependencies solve it?
5. Can it be implemented with fewer lines?
6. Only then create new code.

Prefer:

* Reuse over rewrite
* Native APIs over new dependencies
* Existing services over new services
* Existing contexts over new contexts
* Simplicity over abstraction
* Deletion over addition

Avoid:

* Over-engineering
* Duplicate utilities
* Duplicate hooks
* Duplicate services
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

Reuse existing contexts and services whenever possible.

Preserve backward compatibility.

---

## Dependency Rules

Before installing any package:

1. Check if existing dependency already solves it.
2. Check browser native API.
3. Check Node.js built-in modules.
4. Explain why installation is required.

Never install dependencies for convenience alone.

Prefer:

* Built-in APIs
* Existing project dependencies

Avoid:

* UI libraries
* State libraries
* Utility libraries
* Wrapper libraries

unless absolutely required.

---

## Cache & Storage Optimization Rules

Project should remain lightweight.

Target:

* Cache size below 200MB
* Minimize build artifacts
* Minimize duplicate dependencies

Regularly audit:

* node_modules
* .next
* dist
* build
* coverage
* logs
* temp
* cache directories

Always:

* Remove obsolete caches
* Remove unused dependencies
* Remove stale logs
* Remove duplicate packages

Never:

* Store generated files unnecessarily
* Commit cache artifacts
* Commit build outputs

---

## Before Modifying Anything

1. Identify root cause.
2. Trace data flow.
3. Find existing implementation.
4. Reuse before creating new code.
5. Verify affected screens.

Never guess.

---

## Required Output

Before editing provide:

* Root cause analysis
* Files affected
* Implementation plan

After editing provide:

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

Authentication

Workspace

Meetings

Voice

Tasks

Billing

Theme

Navigation

Analytics

---

## Voice System Rules

Voice architecture is inspired by Discord.

Never:

* Replace voice transport
* Rewrite recording flow
* Replace existing voice pipeline

Before changing voice:

1. Trace microphone flow
2. Trace recording flow
3. Trace playback flow
4. Trace websocket flow

Preserve compatibility.

---

## Memory Rules

Always read:

* .claude/AGENTS.md
* .claude/GUIDELINE.md
* .claude/memory/*

Treat them as project instructions.

Never ignore project memory.

---

## Response Style

Be concise.

Show evidence.

Show affected files.

Show risks.

Never assume implementation details.

Always inspect code first.
