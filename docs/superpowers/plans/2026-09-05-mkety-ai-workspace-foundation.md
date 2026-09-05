# Mkety AI Workspace Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deeper, safe AI Workspace foundation by extracting focused UI components for status, readiness, and agent summaries while keeping backend execution, publishing, billing, and tool registration out of scope.

**Architecture:** Keep `/ai` server-rendered and protected by `requireProjectAccess`. The route should fetch existing project agents and pass display-only data into focused components under `src/features/projects/workspaces/ai/`.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Drizzle, Jest, React Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-05-mkety-ai-workspace-foundation-design.md`

## Global Constraints

- AI is a first-class Mkety Platform capability, not the entire company.
- Existing agent creation/listing behavior must remain available.
- Existing Agent Builder links must remain available.
- Agents and Knowledge may be shown as available.
- Tools, Runs, Versions, and Publish must remain planned/protected.
- Do not add new AI database tables in this branch.
- Do not add real agent run history, tool execution, versioning, or publish behavior in this branch.
- Do not add billing, wallet, credits, usage deduction, deployment automation, or trading runtime.
- Components must be deterministic and testable without database access.

---

## File map

Create:

```text
src/features/projects/workspaces/ai/types.ts
src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.tsx
src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx
src/features/projects/workspaces/ai/AiWorkspaceReadiness.tsx
src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx
src/features/projects/workspaces/ai/AiAgentSummaryGrid.tsx
src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx
.github/workflows/mkety-ai-workspace-foundation-smoke.yml
```

Modify:

```text
src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx
```

---

### Task 1: AI display types

**Files:**
- Create: `src/features/projects/workspaces/ai/types.ts`

**Interfaces:**
- Produces: `AiAgentSummary`, `AiWorkspaceReadinessStatus`, `AiWorkspaceReadinessItem`

- [ ] **Step 1: Create types**

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

export type AiWorkspaceReadinessItem = {
  key: 'agents' | 'knowledge' | 'tools' | 'runs' | 'versions' | 'publish';
  title: string;
  description: string;
  status: AiWorkspaceReadinessStatus;
  href?: string;
  metric?: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projects/workspaces/ai/types.ts
git commit -m "feat: add AI workspace display types"
```

---

### Task 2: AI Workspace status panel

**Files:**
- Create: `src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.tsx`
- Test: `src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: `AiWorkspaceStatusPanel`

- [ ] **Step 1: Write test**

```tsx
import { render, screen } from '@testing-library/react';

import { AiWorkspaceStatusPanel } from './AiWorkspaceStatusPanel';

describe('AiWorkspaceStatusPanel', () => {
  it('shows AI workspace readiness and counts', () => {
    render(<AiWorkspaceStatusPanel agentCount={2} canManage={true} knowledgeStatus="Ready for project knowledge" />);

    expect(screen.getByRole('heading', { name: /AI Workspace status/i })).toBeInTheDocument();
    expect(screen.getByText('2 agents')).toBeInTheDocument();
    expect(screen.getByText('Ready for project knowledge')).toBeInTheDocument();
    expect(screen.getByText(/Management available/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement component**

```tsx
export function AiWorkspaceStatusPanel({
  agentCount,
  canManage,
  knowledgeStatus,
}: {
  agentCount: number;
  canManage: boolean;
  knowledgeStatus: string;
}) {
  return (
    <section aria-labelledby="ai-workspace-status-heading" className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-medium text-muted-foreground">Workspace</p>
        <h2 id="ai-workspace-status-heading" className="mt-1 text-xl font-semibold">
          AI Workspace status
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Agents and Knowledge are available. Tools, Runs, Versions, and Publish stay staged.</p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-medium text-muted-foreground">Agents</p>
        <p className="mt-2 text-2xl font-semibold">{agentCount} {agentCount === 1 ? 'agent' : 'agents'}</p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-medium text-muted-foreground">Knowledge</p>
        <p className="mt-2 text-sm font-medium">{knowledgeStatus}</p>
        <p className="mt-2 text-xs text-muted-foreground">{canManage ? 'Management available' : 'Read-only access'}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run test**

```bash
pnpm test -- src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.tsx src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx
git commit -m "feat: add AI workspace status panel"
```

---

### Task 3: AI Workspace readiness component

**Files:**
- Create: `src/features/projects/workspaces/ai/AiWorkspaceReadiness.tsx`
- Test: `src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx`

**Interfaces:**
- Consumes: `AiWorkspaceReadinessItem`
- Produces: `buildAiWorkspaceReadiness`, `AiWorkspaceReadiness`

- [ ] **Step 1: Write test**

```tsx
import { render, screen } from '@testing-library/react';

import { buildAiWorkspaceReadiness, AiWorkspaceReadiness } from './AiWorkspaceReadiness';

describe('AiWorkspaceReadiness', () => {
  it('keeps tools, runs, versions, and publish staged', () => {
    const items = buildAiWorkspaceReadiness({ agentCount: 1, canManage: true, projectSlug: 'demo', tenantSlug: 'acme' });

    expect(items.find((item) => item.key === 'agents')?.status).toBe('available');
    expect(items.find((item) => item.key === 'knowledge')?.status).toBe('available');
    expect(items.find((item) => item.key === 'tools')?.status).toBe('planned');
    expect(items.find((item) => item.key === 'runs')?.status).toBe('planned');
    expect(items.find((item) => item.key === 'versions')?.status).toBe('planned');
    expect(items.find((item) => item.key === 'publish')?.status).toBe('protected');
  });

  it('renders available links without live execution ctas', () => {
    render(<AiWorkspaceReadiness agentCount={1} canManage={true} projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByRole('link', { name: /Agents/i })).toHaveAttribute('href', '/t/acme/projects/demo/ai');
    expect(screen.getByRole('link', { name: /Knowledge/i })).toHaveAttribute('href', '/t/acme/projects/demo/knowledge');
    expect(screen.queryByRole('link', { name: /Publish now/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run agent/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement component**

Use `Link` only for available Agents and Knowledge. Render planned/protected items as non-link cards.

- [ ] **Step 3: Run test**

```bash
pnpm test -- src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/workspaces/ai/AiWorkspaceReadiness.tsx src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx
git commit -m "feat: add AI workspace readiness component"
```

---

### Task 4: AI agent summary grid

**Files:**
- Create: `src/features/projects/workspaces/ai/AiAgentSummaryGrid.tsx`
- Test: `src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx`

**Interfaces:**
- Consumes: `AiAgentSummary[]`
- Produces: `AiAgentSummaryGrid`

- [ ] **Step 1: Write test**

```tsx
import { render, screen } from '@testing-library/react';

import { AiAgentSummaryGrid } from './AiAgentSummaryGrid';

describe('AiAgentSummaryGrid', () => {
  it('links agents to Agent Builder', () => {
    render(
      <AiAgentSummaryGrid
        agents={[{ id: '1', name: 'Support Bot', slug: 'support-bot', status: 'draft', provider: 'openai', model: 'gpt-4o', instructions: 'Answer support questions.' }]}
        canManage={true}
        projectSlug="demo"
        tenantSlug="acme"
      />,
    );

    expect(screen.getByRole('link', { name: /Support Bot/i })).toHaveAttribute('href', '/t/acme/projects/demo/agents/support-bot');
    expect(screen.getByText(/Open Agent Builder/i)).toBeInTheDocument();
  });

  it('renders a helpful no-agent state', () => {
    render(<AiAgentSummaryGrid agents={[]} canManage={true} projectSlug="demo" tenantSlug="acme" />);

    expect(screen.getByText(/No agents yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Create your first AI agent/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement component**

Move agent list rendering from the route into this component.

- [ ] **Step 3: Run test**

```bash
pnpm test -- src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/features/projects/workspaces/ai/AiAgentSummaryGrid.tsx src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx
git commit -m "feat: add AI agent summary grid"
```

---

### Task 5: Refactor AI route

**Files:**
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx`

**Interfaces:**
- Consumes: `AiWorkspaceStatusPanel`, `AiWorkspaceReadiness`, `AiAgentSummaryGrid`

- [ ] **Step 1: Replace inline overview/list sections**

Keep `createAgent` form in the route for now, but replace inline status/readiness/list rendering with the new components.

- [ ] **Step 2: Preserve behavior**

The route must still:

```ts
export const dynamic = 'force-dynamic';
```

Use:

```ts
requireProjectAccess({ projectSlug, tenantSlug })
```

Fetch agents scoped by tenant and project.

- [ ] **Step 3: Run type-check**

```bash
pnpm type-check
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx
git commit -m "refactor: compose AI workspace route from focused components"
```

---

### Task 6: Focused AI smoke workflow and PR

**Files:**
- Create: `.github/workflows/mkety-ai-workspace-foundation-smoke.yml`

**Interfaces:**
- Produces: GitHub Actions verification for this branch/PR.

- [ ] **Step 1: Create workflow**

```yaml
name: Mkety AI Workspace Foundation Smoke

on:
  workflow_dispatch:
  pull_request:
    branches:
      - main
    paths:
      - 'src/app/(tenant)/t/[tenant]/projects/**'
      - 'src/features/projects/workspaces/ai/**'
      - 'docs/superpowers/specs/2026-09-05-mkety-ai-workspace-foundation-design.md'
      - 'docs/superpowers/plans/2026-09-05-mkety-ai-workspace-foundation.md'
      - '.github/workflows/mkety-ai-workspace-foundation-smoke.yml'

concurrency:
  group: mkety-ai-workspace-foundation-smoke-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ai-workspace-smoke:
    name: Test Mkety AI workspace foundation
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run AI workspace tests
        run: pnpm test -- src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx

      - name: Type-check
        run: pnpm type-check
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/mkety-ai-workspace-foundation-smoke.yml
git commit -m "ci: add AI workspace foundation smoke workflow"
```

- [ ] **Step 3: Open draft PR**

Title:

```text
Build: Mkety AI Workspace foundation
```

- [ ] **Step 4: Verify PR checks**

Required:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Focused workflow:

```bash
pnpm test -- src/features/projects/workspaces/ai/AiWorkspaceStatusPanel.test.tsx src/features/projects/workspaces/ai/AiWorkspaceReadiness.test.tsx src/features/projects/workspaces/ai/AiAgentSummaryGrid.test.tsx
pnpm type-check
```

---

## Self-review

- Spec coverage: covered status panel, readiness, agent summary grid, route refactor, smoke workflow, and protected planned AI surfaces.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: `AiAgentSummary`, `AiWorkspaceReadinessStatus`, and `AiWorkspaceReadinessItem` are defined once and consumed by later tasks.
- Boundary check: no new backend tables, billing, publish runtime, tool execution, deployment, or trading logic.
