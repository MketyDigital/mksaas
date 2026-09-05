# Mkety Platform Core Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated Mkety Platform project workspace shell so every project has clear AI, Automate, Deploy, SolutionHub, and Trading/Enterprise entry points.

**Architecture:** Keep route behavior code-owned through a focused workspace registry, then render shared hub/shell components from that registry. Reuse the current tenant/project/membership DB model and existing AI agent/knowledge routes instead of introducing a new workspace persistence layer in this branch.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5.9, Drizzle ORM, NextAuth, Jest, Testing Library, Tailwind CSS, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-05-mkety-platform-core-workspaces-design.md`

## Progress ledger

- [x] Public/CMS foundation merged into `main` before starting this branch.
- [x] Platform Core Workspace Shell created.
- [x] Workspace registry created and tested.
- [x] Shared server-side project access guard created.
- [x] Project detail page converted into a workspace hub.
- [x] AI, Automation, Deploy, SolutionHub, and Trading route shells created.
- [x] WorkspaceShell cross-workspace switcher added and tested.
- [x] Project hub readiness summary added and tested.
- [x] AI Workspace overview added and tested.
- [x] Existing AI agent creation/listing flow wired into `/ai`.
- [x] Agent Builder wrapped in the AI Workspace shell and shared access guard.
- [x] Focused workspace smoke workflow added and passing.
- [x] Full CI passing on the latest Agent Builder slice.

## Global Constraints

- Follow `AGENTS.md`; Mkety is not AI-only.
- Mkety Platform is the main SaaS/PaaS product; Mkety Academy remains separate.
- Trading must stay visible as Custom/Enterprise, not self-service trading execution.
- This branch must not create trading-account, broker, signal, copy-trading, or execution tables.
- This branch must not implement real deployment infrastructure automation.
- This branch must not implement real billing ledger/wallet money movement.
- Workspace route behavior and protected status are code-controlled.
- Presentation may later use CMS/app-experience content, but CMS must not unlock protected product behavior.
- Every project workspace route must verify authenticated membership and project ownership server-side.
- Keep `pnpm test`, `pnpm type-check`, `pnpm lint`, and `pnpm build` green.

---

## Implemented Scope in This Branch

### Workspace foundation

- `src/features/projects/server/access.ts`
- `src/features/projects/workspaces/types.ts`
- `src/features/projects/workspaces/registry.ts`
- `src/features/projects/workspaces/WorkspaceHub.tsx`
- `src/features/projects/workspaces/WorkspaceShell.tsx`
- `src/features/projects/workspaces/WorkspaceEmptyState.tsx`

### Workspace routes

- `src/app/(tenant)/t/[tenant]/projects/[project]/page.tsx`
- `src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx`
- `src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx`
- `src/app/(tenant)/t/[tenant]/projects/[project]/deploy/page.tsx`
- `src/app/(tenant)/t/[tenant]/projects/[project]/solutions/page.tsx`
- `src/app/(tenant)/t/[tenant]/projects/[project]/trading/page.tsx`

### AI workspace polish

- `src/features/projects/workspaces/AiWorkspaceOverview.tsx`
- Existing Agent Builder page now uses `WorkspaceShell` and `requireProjectAccess`.

### Verification

Latest verified head before this docs update: `407c2928c39abe720082ea976644ed4ed4e40845`.

Passed:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Focused workspace smoke passed:

```bash
pnpm test -- src/features/projects/workspaces/registry.test.ts src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx src/features/projects/workspaces/AiWorkspaceOverview.test.tsx
pnpm type-check
```

---

## Remaining Next Slices

### Next Slice A — Automation Workspace Foundation

- Add an Automation Workspace overview.
- Show current workflow surfaces if existing workflow tables/routes are available.
- Keep real workflow-engine expansion out of this branch unless already supported by existing code.
- Add focused tests.

### Next Slice B — Deploy Workspace Foundation

- Add a Deploy Workspace overview for apps, environments, deployments, previews, and domains.
- Keep real Cloudflare/OCI automation out of this branch.
- Add focused tests.

### Next Slice C — SolutionHub Foundation

- Add a SolutionHub overview for templates, blueprints, ready-made systems, and enterprise requests.
- Keep install/provisioning logic out of this branch unless explicitly planned.
- Add focused tests.

### Next Slice D — PR readiness

- Update PR #6 verification.
- Mark ready for review only after full CI is green and all intended shell slices are complete.
- Merge only when the workspace foundation is stable enough to support deeper AI/Automation/Deploy branches.
