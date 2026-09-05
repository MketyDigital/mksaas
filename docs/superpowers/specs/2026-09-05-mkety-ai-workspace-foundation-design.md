# Mkety AI Workspace Foundation Design

## Document status

- **Status:** Approved for inline execution
- **Date:** 2026-09-05
- **Branch:** `feat/mkety-ai-workspace-foundation`
- **Repository:** `MketyDigital/mksaas`
- **Depends on:** PR #6 / `e34c089c7b130729aa8a62c6eb8146a43f7b08b3`

## Goal

Build the next AI Workspace foundation layer on top of the merged project workspace shell so `app.mkety.com` presents AI as a coherent product surface, while avoiding premature backend execution, billing, publishing, or infrastructure work.

## Context

PR #6 moved the authenticated project area from an agent-only page into a Mkety Platform workspace hub with AI, Automate, Deploy, SolutionHub, and Trading workspaces. AI is the only currently available workspace. The current AI route already contains an overview, create-agent form, and agent list in one page.

This phase should make AI feel deeper and more intentional without introducing new production-critical backend systems too early.

## Product principles

- AI is a first-class Mkety Platform capability, not the entire company.
- AI Workspace should help users understand what is ready now and what is intentionally staged.
- Existing agent and knowledge functionality should remain available.
- Planned surfaces should be visible but clearly protected.
- No feature should imply live execution, publishing, billing, or external integrations before those systems exist.

## Target user experience

On `/t/[tenant]/projects/[project]/ai`, users should see:

1. A clear AI workspace status panel.
2. Agent count and management status.
3. Knowledge readiness status.
4. Safe planned/protected surfaces for Tools, Runs, Versions, and Publish.
5. Agent summary cards with direct links to Agent Builder.
6. A create-agent area that feels like part of AI Workspace.
7. Copy explaining that runs, tools, versions, and publishing are controlled future layers.

## Scope for this branch

### In scope

- Extract AI route UI into focused reusable components.
- Add AI workspace status/readiness presentation.
- Add agent summary grid component.
- Add knowledge readiness messaging.
- Improve empty-state copy for projects with no agents.
- Keep existing create-agent action and agent list behavior.
- Add tests for AI status, readiness, agent links, no-agent state, and protected planned surfaces.
- Add a focused AI workspace smoke workflow or extend an existing focused workflow if present.
- Open a draft PR for review after verified CI.

### Out of scope

- New AI database tables.
- Real agent run history.
- Real tool execution or API-tool registration.
- Agent version snapshots.
- Publish-to-production behavior.
- Billing, usage, wallet, credit deduction, or plan entitlements.
- Vector database/storage schema changes.
- Deployment automation.
- Trading runtime or trading data.

## Architectural approach

Create focused AI Workspace presentation components under `src/features/projects/workspaces/ai/` and keep the route thin. The route should fetch project access and existing project agents, then pass safe display data into UI components.

The route remains server-rendered and tenant-scoped through `requireProjectAccess`. The component layer should be deterministic and testable without hitting the database.

## Proposed file structure

```text
src/features/projects/workspaces/ai/
  types.ts
  AiWorkspaceStatusPanel.tsx
  AiWorkspaceStatusPanel.test.tsx
  AiAgentSummaryGrid.tsx
  AiAgentSummaryGrid.test.tsx
  AiWorkspaceReadiness.tsx
  AiWorkspaceReadiness.test.tsx
```

Modify:

```text
src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx
.github/workflows/mkety-ai-workspace-foundation-smoke.yml
```

## Data contracts

Use display-only types rather than database row types in components.

```ts
export type AiAgentSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
  provider: string | null;
  model: string | null;
  instructions: string | null;
};

export type AiWorkspaceReadinessStatus = 'available' | 'planned' | 'protected';
```

## Required UI boundaries

The AI Workspace may display these as available:

- Agents
- Knowledge

The AI Workspace may display these only as planned/protected:

- Tools
- Runs
- Versions
- Publish

The UI must not include live links or buttons that imply:

- Run agent now
- Publish now
- Connect paid model billing
- Deduct credits
- Deploy production agent
- Register external tools

## Testing requirements

Tests must verify:

- Status panel shows AI Workspace readiness and agent count.
- Knowledge is presented as available but scoped to project readiness.
- Tools, Runs, Versions, and Publish remain planned/protected.
- Agent summary grid links to existing Agent Builder routes.
- No-agent state renders helpful guidance.
- Components do not expose live publish/run/tool execution CTAs.

## Verification requirements

Before the PR leaves draft:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Focused AI smoke should run:

```bash
pnpm test -- src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx
pnpm type-check
```

## Success criteria

- `/ai` remains functional and server-protected.
- Existing agent creation/listing behavior remains intact.
- Agent Builder links still work.
- AI Workspace feels like a product surface instead of one mixed page.
- Planned/protected AI capabilities are visible without implying live backend availability.
- Full CI and focused AI smoke pass.
