# Mkety Platform Core Workspaces Design

> **Status:** PLANNED
> **Branch:** `feat/mkety-platform-core-workspaces`
> **Date:** 2026-09-05
> **Owner:** Mkety Platform
> **Source of truth:** `AGENTS.md`

## 1. Purpose

This specification starts the heavy `app.mkety.com` phase after the public website/CMS/control-center foundation was merged into `main`.

The goal is to convert the authenticated tenant project area from an AI-agent-centered screen into a true Mkety Platform workspace hub. Mkety Platform must present AI, Automate, Deploy, SolutionHub, and Enterprise/Trading as first-class workspace entry points while preserving the current project, tenant, membership, and agent flows that already exist.

This is not the full implementation of every workspace engine. It is the core shell and route foundation that lets the next phases build real AI, automation, deployment, solution, billing, and enterprise features without reworking navigation again.

## 2. Blueprint alignment

This design follows the `AGENTS.md` authority:

- Mkety is not AI-only.
- Mkety Platform is the primary SaaS/PaaS product.
- Mkety Academy remains the second primary product and is not implemented inside this branch.
- Trading remains visible as a Custom/Enterprise solution, not a self-service core subscription product.
- Backend logic, billing ledger calculations, tenant isolation, security rules, deployment engines, and Auth Gateway enforcement remain code-controlled.
- Admin-editable app-experience content may influence presentation, labels, and visibility, but cannot alter protected product logic.

## 3. Current repo state

The branch starts from the merged public foundation commit and already has:

- Tenant app route: `src/app/(tenant)/t/[tenant]`.
- Projects list route: `src/app/(tenant)/t/[tenant]/projects/page.tsx`.
- Project route: `src/app/(tenant)/t/[tenant]/projects/[project]/page.tsx`.
- Existing project actions: `src/features/projects/actions.ts`.
- Existing project feature files: `src/features/projects/AgentPlayground.tsx`, `actions.ts`, and `agent-actions.ts`.
- Existing nested project areas: `agents` and `knowledge`.
- Public/app experience defaults and loaders from the merged foundation PR.

The current project page combines project overview, agent creation, and agents list. This branch should separate those responsibilities:

- Project overview becomes a workspace hub.
- AI work moves into an AI workspace route shell and can link to existing agents/knowledge routes.
- Other workspace shells are introduced with safe empty states.

## 4. Non-goals for this branch

This branch must not attempt to finish the entire platform.

Non-goals:

- Do not implement real deployment infrastructure automation.
- Do not implement real billing ledger/wallet money movement.
- Do not build a full trading execution, broker, signals, or copy-trading system.
- Do not implement Auth Gateway token issuance or JWKS signing.
- Do not change the domain map.
- Do not introduce broad new paid-feature logic.
- Do not move Academy into Platform.
- Do not replace the existing tenant/project schema unless the current schema is insufficient for workspace shell behavior.

## 5. Product model

Mkety Platform should be organized as:

```text
Tenant / Workspace
  -> Projects
    -> Workspace hub
      -> AI
      -> Automate
      -> Deploy
      -> SolutionHub
      -> Trading / Enterprise
      -> Settings / Activity / Usage entry points
```

A project is the user's working container. Workspaces are capability areas inside that project.

## 6. Route model

The initial route model should be:

```text
/t/[tenant]/projects
/t/[tenant]/projects/[project]
/t/[tenant]/projects/[project]/ai
/t/[tenant]/projects/[project]/automation
/t/[tenant]/projects/[project]/deploy
/t/[tenant]/projects/[project]/solutions
/t/[tenant]/projects/[project]/trading
```

Existing routes should remain supported:

```text
/t/[tenant]/projects/[project]/agents
/t/[tenant]/projects/[project]/agents/[agent]
/t/[tenant]/projects/[project]/knowledge
```

The new `/ai` route should act as the Mkety AI workspace entry point and link to existing `agents` and `knowledge` areas until deeper AI workspace work is implemented.

## 7. Workspace registry

Create a focused workspace registry under `src/features/projects/workspaces/`.

Recommended files:

```text
src/features/projects/workspaces/registry.ts
src/features/projects/workspaces/types.ts
src/features/projects/workspaces/WorkspaceHub.tsx
src/features/projects/workspaces/WorkspaceShell.tsx
src/features/projects/workspaces/WorkspaceEmptyState.tsx
src/features/projects/workspaces/registry.test.ts
```

The registry should define the initial workspaces using stable keys:

```text
ai
automation
deploy
solutions
trading
```

Each workspace definition should include:

- `key`
- `title`
- `shortTitle`
- `description`
- `statusLabel`
- `hrefSegment`
- `availability`
- `primaryCtaLabel`
- `secondaryCtaLabel` where useful
- `protectedReason` where useful

Availability values:

```text
available
planned
enterprise
protected
```

Interpretation:

- `available`: safe to enter now.
- `planned`: visible but still foundation/coming soon.
- `enterprise`: visible but positioned as Custom/Enterprise.
- `protected`: visible to explain scope but not user-configurable.

Initial availability:

- AI: `available` because existing agents/knowledge flows already exist.
- Automate: `planned`.
- Deploy: `planned`.
- SolutionHub: `planned`.
- Trading: `enterprise`.

## 8. Project workspace hub

The project homepage at `/t/[tenant]/projects/[project]` should become a workspace hub.

It should show:

- Project title and description.
- Tenant/project context.
- Workspace cards for AI, Automate, Deploy, SolutionHub, and Trading.
- A smaller existing-resources section for current agents.
- Clear empty states.
- Management CTA for users with admin/manager role.

The existing inline “Create AI agent” form should move out of the project homepage. It can be placed on the new AI workspace page or kept behind a link to existing agent routes, depending on what current route components support cleanly.

The homepage should not directly create automation workflows, deployments, billing records, or trading records.

## 9. Workspace shell pages

Each workspace route should use a shared shell component so future implementation can fill the body without changing the outer structure.

The shared shell should render:

- Workspace title.
- Status label.
- Project context.
- Description.
- Primary action link/button.
- Secondary links where available.
- Empty state / next steps.
- Enterprise/protected notice where appropriate.

### AI workspace

The AI workspace should be the only route with links to existing real functionality in this batch.

It should show:

- Link to existing Agents area.
- Link to existing Knowledge area.
- Existing agent count if inexpensive to query.
- “Create/open Agent Builder” CTA where existing actions support it.

### Automation workspace

The Automation workspace should be a planned shell.

It should explain that Automate will manage:

- workflows
- triggers
- actions
- webhooks
- run history
- retries/failures

No workflow engine changes are required in this batch.

### Deploy workspace

The Deploy workspace should be a planned shell.

It should explain that Deploy will manage:

- apps
- websites
- APIs
- environments
- domains
- previews
- deployment history

No real Cloudflare/OCI deployment logic is required in this batch.

### SolutionHub workspace

The SolutionHub workspace should be a planned shell.

It should explain that SolutionHub will include:

- ready-made solutions
- templates
- blueprints
- business systems
- enterprise request flows

No install engine is required in this batch.

### Trading workspace

The Trading workspace should be visible but enterprise-gated.

It must explain that Trading is a Custom/Enterprise solution area and that no trading-account, signal, broker, copy-trading, or execution data is created in this branch.

It should include a safe CTA such as “Contact Mkety for Trading systems” or “Request enterprise trading workspace”.

## 10. Access control

All project workspace routes must enforce the same basic access boundary as the existing project page:

- Authenticated user required.
- Tenant must exist.
- User must be a tenant member.
- Project must belong to tenant.

A shared server helper should be introduced to avoid duplicating this logic across every workspace route.

Recommended helper:

```text
src/features/projects/server/access.ts
```

Recommended function:

```ts
requireProjectAccess(params: { tenantSlug: string; projectSlug: string })
```

Return value should include:

```ts
{
  session,
  tenant,
  membership,
  project,
  canManage
}
```

`canManage` should be true when membership role is `admin` or `manager`.

Unauthorized behavior should match existing app behavior:

- Missing session redirects to login where existing helpers do so.
- Missing tenant/project returns safe not-found style UI or uses Next `notFound()` if existing patterns support it.
- Non-member returns a forbidden UI or uses existing forbidden handling.

## 11. Data flow

Initial data flow:

```text
Route params
  -> requireProjectAccess
  -> workspace registry
  -> optional project-scoped counts
  -> WorkspaceHub or WorkspaceShell
```

The route should not trust path params alone. Every route must verify tenant membership and project ownership server-side before rendering project information.

## 12. Integration with app-experience CMS

The merged foundation added app-experience defaults and database content for workspace cards. This branch can begin with a code-owned registry for route behavior.

If practical without overcomplication, the hub may merge presentation from the app-experience loader with the code-owned workspace registry.

Rule:

- Code-owned registry controls route keys, protected status, and product behavior.
- CMS/app-experience content may influence labels, descriptions, display ordering, and enabled state.
- CMS must not convert Trading into self-service or unlock protected product behavior.

If merging CMS data adds too much risk, keep this branch code-registry-first and add CMS override integration in a later branch.

## 13. Testing requirements

Minimum tests for this branch:

- Workspace registry contains all required workspace keys.
- Trading workspace is `enterprise` availability.
- AI workspace href segment is `ai`.
- Route helper returns `canManage` correctly for admin/manager roles, if testable with current mocking patterns.
- Workspace hub renders AI, Automate, Deploy, SolutionHub, and Trading cards.
- Trading card/shell copy does not imply self-service trading execution.

If route-helper testing is too coupled to existing DB/auth mocks, start with registry and component rendering tests and keep route access logic simple and reviewed.

## 14. CI and verification

Every implementation batch must keep these green:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

For this branch, the live DB smoke workflow from the previous public CMS PR is not the main signal unless CMS files are changed. Normal CI is the required verification for workspace shell changes.

## 15. Rollout and handoff

When this branch is complete, Mkety should have a navigable authenticated project workspace foundation.

Expected user-facing result:

- Projects list still works.
- Project detail page becomes the hub for Mkety Platform capabilities.
- AI has a real entry point into existing agent/knowledge functionality.
- Automate, Deploy, and SolutionHub are visible and properly framed as planned platform areas.
- Trading is visible but clearly enterprise/custom and not mixed with real trading data.

This branch should then hand off to the next phase: AI Workspace Foundation.
