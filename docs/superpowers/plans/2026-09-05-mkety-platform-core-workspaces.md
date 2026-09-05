# Mkety Platform Core Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated Mkety Platform project workspace shell so every project has clear AI, Automate, Deploy, SolutionHub, and Trading/Enterprise entry points.

**Architecture:** Keep route behavior code-owned through a focused workspace registry, then render shared hub/shell components from that registry. Reuse the current tenant/project/membership DB model and existing AI agent/knowledge routes instead of introducing a new workspace persistence layer in this branch.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5.9, Drizzle ORM, NextAuth, Jest, Testing Library, Tailwind CSS, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-05-mkety-platform-core-workspaces-design.md`

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

## File Structure

Create:

- `src/features/projects/server/access.ts` — shared project access helper for tenant, membership, project, and `canManage` resolution.
- `src/features/projects/workspaces/types.ts` — workspace key, availability, and definition types.
- `src/features/projects/workspaces/registry.ts` — code-owned workspace definitions and helper lookup functions.
- `src/features/projects/workspaces/WorkspaceHub.tsx` — card grid for project workspace entry points.
- `src/features/projects/workspaces/WorkspaceShell.tsx` — shared layout for workspace route shells.
- `src/features/projects/workspaces/WorkspaceEmptyState.tsx` — reusable empty-state panel for planned/enterprise workspaces.
- `src/features/projects/workspaces/registry.test.ts` — registry safety tests.
- `src/features/projects/workspaces/WorkspaceHub.test.tsx` — hub rendering tests.
- `src/features/projects/workspaces/WorkspaceShell.test.tsx` — shell rendering tests.
- `src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx` — AI workspace entry route.
- `src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx` — Automate workspace route shell.
- `src/app/(tenant)/t/[tenant]/projects/[project]/deploy/page.tsx` — Deploy workspace route shell.
- `src/app/(tenant)/t/[tenant]/projects/[project]/solutions/page.tsx` — SolutionHub workspace route shell.
- `src/app/(tenant)/t/[tenant]/projects/[project]/trading/page.tsx` — enterprise Trading workspace route shell.

Modify:

- `src/app/(tenant)/t/[tenant]/projects/[project]/page.tsx` — convert from agent-centered page to workspace hub.
- `src/features/projects/actions.ts` — only if the AI page needs to redirect new agent creation to `/ai` or existing agent routes. Avoid broad changes.
- `src/shared/components/layout/nav/MyViewNav.tsx` — only if tenant navigation needs a link label update to Projects/Platform. Avoid broad nav restructuring.

---

### Task 1: Workspace Registry

**Files:**
- Create: `src/features/projects/workspaces/types.ts`
- Create: `src/features/projects/workspaces/registry.ts`
- Test: `src/features/projects/workspaces/registry.test.ts`

**Interfaces:**
- Produces: `type WorkspaceKey = 'ai' | 'automation' | 'deploy' | 'solutions' | 'trading'`
- Produces: `type WorkspaceAvailability = 'available' | 'planned' | 'enterprise' | 'protected'`
- Produces: `type ProjectWorkspaceDefinition`
- Produces: `projectWorkspaces: ProjectWorkspaceDefinition[]`
- Produces: `getProjectWorkspaceByKey(key: WorkspaceKey): ProjectWorkspaceDefinition`

- [ ] **Step 1: Write failing registry tests**

Create `src/features/projects/workspaces/registry.test.ts`:

```ts
import { getProjectWorkspaceByKey, projectWorkspaces } from './registry';

describe('projectWorkspaces', () => {
  it('defines the required Mkety platform workspace keys in order', () => {
    expect(projectWorkspaces.map((workspace) => workspace.key)).toEqual(['ai', 'automation', 'deploy', 'solutions', 'trading']);
  });

  it('keeps Trading enterprise-gated and not self-service', () => {
    const trading = getProjectWorkspaceByKey('trading');

    expect(trading.availability).toBe('enterprise');
    expect(trading.description.toLowerCase()).toContain('enterprise');
    expect(trading.protectedReason?.toLowerCase()).toContain('custom');
  });

  it('routes AI through the ai segment', () => {
    expect(getProjectWorkspaceByKey('ai').hrefSegment).toBe('ai');
    expect(getProjectWorkspaceByKey('ai').availability).toBe('available');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- src/features/projects/workspaces/registry.test.ts
```

Expected: FAIL because `registry.ts` does not exist.

- [ ] **Step 3: Implement registry types**

Create `src/features/projects/workspaces/types.ts`:

```ts
export type WorkspaceKey = 'ai' | 'automation' | 'deploy' | 'solutions' | 'trading';

export type WorkspaceAvailability = 'available' | 'planned' | 'enterprise' | 'protected';

export type ProjectWorkspaceDefinition = {
  key: WorkspaceKey;
  title: string;
  shortTitle: string;
  description: string;
  hrefSegment: string;
  availability: WorkspaceAvailability;
  statusLabel: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  protectedReason?: string;
};
```

- [ ] **Step 4: Implement registry**

Create `src/features/projects/workspaces/registry.ts`:

```ts
import type { ProjectWorkspaceDefinition, WorkspaceKey } from './types';

export const projectWorkspaces: ProjectWorkspaceDefinition[] = [
  {
    key: 'ai',
    title: 'AI Workspace',
    shortTitle: 'AI',
    description: 'Create agents, connect knowledge, configure tools, and test AI-powered workflows inside this project.',
    hrefSegment: 'ai',
    availability: 'available',
    statusLabel: 'Available',
    primaryCtaLabel: 'Open AI Workspace',
    secondaryCtaLabel: 'Manage agents',
  },
  {
    key: 'automation',
    title: 'Automation Workspace',
    shortTitle: 'Automate',
    description: 'Design workflows, triggers, actions, webhooks, and run history for repeatable business operations.',
    hrefSegment: 'automation',
    availability: 'planned',
    statusLabel: 'Planned',
    primaryCtaLabel: 'Preview Automation',
  },
  {
    key: 'deploy',
    title: 'Deploy Workspace',
    shortTitle: 'Deploy',
    description: 'Manage apps, websites, APIs, environments, previews, production deployments, and domains.',
    hrefSegment: 'deploy',
    availability: 'planned',
    statusLabel: 'Planned',
    primaryCtaLabel: 'Preview Deploy',
  },
  {
    key: 'solutions',
    title: 'SolutionHub',
    shortTitle: 'Solutions',
    description: 'Explore ready-made solutions, templates, blueprints, and enterprise implementation paths.',
    hrefSegment: 'solutions',
    availability: 'planned',
    statusLabel: 'Planned',
    primaryCtaLabel: 'Open SolutionHub',
  },
  {
    key: 'trading',
    title: 'Trading Workspace',
    shortTitle: 'Trading',
    description: 'Request custom enterprise trading systems without mixing website display records with broker, signal, or execution data.',
    hrefSegment: 'trading',
    availability: 'enterprise',
    statusLabel: 'Custom / Enterprise',
    primaryCtaLabel: 'Request Trading System',
    protectedReason: 'Trading is a custom enterprise solution. This shell does not create trading accounts, signals, broker links, copy trading, or execution records.',
  },
];

export function getProjectWorkspaceByKey(key: WorkspaceKey) {
  const workspace = projectWorkspaces.find((item) => item.key === key);
  if (!workspace) {
    throw new Error(`Unknown Mkety workspace: ${key}`);
  }
  return workspace;
}
```

- [ ] **Step 5: Run registry test**

Run:

```bash
pnpm test -- src/features/projects/workspaces/registry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/projects/workspaces/types.ts src/features/projects/workspaces/registry.ts src/features/projects/workspaces/registry.test.ts
git commit -m "feat: add Mkety project workspace registry"
```

---

### Task 2: Shared Project Access Helper

**Files:**
- Create: `src/features/projects/server/access.ts`
- Modify later consumers only after helper exists.

**Interfaces:**
- Consumes: `db`, `auth`, `getTenantBySlug`, `projects`, `tenantMemberships`.
- Produces: `requireProjectAccess(params: { tenantSlug: string; projectSlug: string })`.
- Produces: `ProjectAccessContext` with `{ session, tenant, membership, project, canManage }`.

- [ ] **Step 1: Implement helper using existing project page logic**

Create `src/features/projects/server/access.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db';
import { projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function requireProjectAccess({ tenantSlug, projectSlug }: { tenantSlug: string; projectSlug: string }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    return { status: 'not-found' as const, reason: 'Workspace not found.' };
  }

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });

  if (!membership) {
    return { status: 'forbidden' as const, reason: 'Forbidden.' };
  }

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)),
  });

  if (!project) {
    return { status: 'not-found' as const, reason: 'Project not found.' };
  }

  return {
    status: 'ok' as const,
    session,
    tenant,
    membership,
    project,
    canManage: membership.role === 'admin' || membership.role === 'manager',
  };
}
```

- [ ] **Step 2: Build once for type signal**

Run:

```bash
pnpm type-check
```

Expected: PASS. If TypeScript cannot narrow the union clearly in consumers later, add exported helper predicates in the consumer task instead of weakening the access function.

- [ ] **Step 3: Commit**

```bash
git add src/features/projects/server/access.ts
git commit -m "feat: add shared project access guard"
```

---

### Task 3: Workspace UI Components

**Files:**
- Create: `src/features/projects/workspaces/WorkspaceHub.tsx`
- Create: `src/features/projects/workspaces/WorkspaceShell.tsx`
- Create: `src/features/projects/workspaces/WorkspaceEmptyState.tsx`
- Test: `src/features/projects/workspaces/WorkspaceHub.test.tsx`
- Test: `src/features/projects/workspaces/WorkspaceShell.test.tsx`

**Interfaces:**
- Consumes: `ProjectWorkspaceDefinition`.
- Produces: `<WorkspaceHub tenantSlug projectSlug projectName workspaces />`.
- Produces: `<WorkspaceShell tenantSlug projectSlug projectName workspace children />`.
- Produces: `<WorkspaceEmptyState title description actions />`.

- [ ] **Step 1: Write WorkspaceHub rendering test**

Create `src/features/projects/workspaces/WorkspaceHub.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { projectWorkspaces } from './registry';
import { WorkspaceHub } from './WorkspaceHub';

describe('WorkspaceHub', () => {
  it('renders every Mkety project workspace card', () => {
    render(<WorkspaceHub projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspaces={projectWorkspaces} />);

    expect(screen.getByRole('heading', { name: /Demo Project/i })).toBeInTheDocument();
    expect(screen.getByText('AI Workspace')).toBeInTheDocument();
    expect(screen.getByText('Automation Workspace')).toBeInTheDocument();
    expect(screen.getByText('Deploy Workspace')).toBeInTheDocument();
    expect(screen.getByText('SolutionHub')).toBeInTheDocument();
    expect(screen.getByText('Trading Workspace')).toBeInTheDocument();
  });

  it('links workspace cards to their project routes', () => {
    render(<WorkspaceHub projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspaces={projectWorkspaces} />);

    expect(screen.getByRole('link', { name: /Open AI Workspace/i })).toHaveAttribute('href', '/t/acme/projects/demo/ai');
    expect(screen.getByRole('link', { name: /Request Trading System/i })).toHaveAttribute('href', '/t/acme/projects/demo/trading');
  });
});
```

- [ ] **Step 2: Write WorkspaceShell rendering test**

Create `src/features/projects/workspaces/WorkspaceShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';

import { getProjectWorkspaceByKey } from './registry';
import { WorkspaceShell } from './WorkspaceShell';

describe('WorkspaceShell', () => {
  it('renders workspace title, project context, and children', () => {
    render(
      <WorkspaceShell projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspace={getProjectWorkspaceByKey('automation')}>
        <p>Workflow builder coming soon.</p>
      </WorkspaceShell>,
    );

    expect(screen.getByRole('heading', { name: 'Automation Workspace' })).toBeInTheDocument();
    expect(screen.getByText(/Demo Project/i)).toBeInTheDocument();
    expect(screen.getByText('Workflow builder coming soon.')).toBeInTheDocument();
  });

  it('renders enterprise protection copy for Trading', () => {
    render(
      <WorkspaceShell projectName="Demo Project" projectSlug="demo" tenantSlug="acme" workspace={getProjectWorkspaceByKey('trading')}>
        <p>Trading system request only.</p>
      </WorkspaceShell>,
    );

    expect(screen.getByText(/custom enterprise solution/i)).toBeInTheDocument();
    expect(screen.getByText(/does not create trading accounts/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm test -- src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 4: Implement WorkspaceEmptyState**

Create `src/features/projects/workspaces/WorkspaceEmptyState.tsx`:

```tsx
import Link from 'next/link';

export function WorkspaceEmptyState({
  title,
  description,
  actions = [],
}: {
  title: string;
  description: string;
  actions?: { href: string; label: string }[];
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/60">
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement WorkspaceHub**

Create `src/features/projects/workspaces/WorkspaceHub.tsx`:

```tsx
import Link from 'next/link';

import type { ProjectWorkspaceDefinition } from './types';

export function WorkspaceHub({
  projectName,
  projectSlug,
  tenantSlug,
  workspaces,
}: {
  projectName: string;
  projectSlug: string;
  tenantSlug: string;
  workspaces: ProjectWorkspaceDefinition[];
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Mkety Platform project</p>
        <h1 className="text-2xl font-semibold">{projectName}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Choose a workspace to build AI systems, automate operations, prepare deployments, explore solutions, or request enterprise trading infrastructure.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((workspace) => (
          <article key={workspace.key} className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium">{workspace.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{workspace.description}</p>
              </div>
              <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{workspace.statusLabel}</span>
            </div>
            {workspace.protectedReason && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{workspace.protectedReason}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/t/${tenantSlug}/projects/${projectSlug}/${workspace.hrefSegment}`} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                {workspace.primaryCtaLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Implement WorkspaceShell**

Create `src/features/projects/workspaces/WorkspaceShell.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { ProjectWorkspaceDefinition } from './types';

export function WorkspaceShell({
  children,
  projectName,
  projectSlug,
  tenantSlug,
  workspace,
}: {
  children: ReactNode;
  projectName: string;
  projectSlug: string;
  tenantSlug: string;
  workspace: ProjectWorkspaceDefinition;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <Link href={`/t/${tenantSlug}/projects/${projectSlug}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
        ← Back to project workspaces
      </Link>
      <section className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{projectName}</p>
            <h1 className="mt-1 text-2xl font-semibold">{workspace.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{workspace.description}</p>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">{workspace.statusLabel}</span>
        </div>
        {workspace.protectedReason && <p className="mt-5 rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">{workspace.protectedReason}</p>}
      </section>
      {children}
    </main>
  );
}
```

- [ ] **Step 7: Run component tests**

Run:

```bash
pnpm test -- src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/projects/workspaces/WorkspaceHub.tsx src/features/projects/workspaces/WorkspaceShell.tsx src/features/projects/workspaces/WorkspaceEmptyState.tsx src/features/projects/workspaces/WorkspaceHub.test.tsx src/features/projects/workspaces/WorkspaceShell.test.tsx
git commit -m "feat: add Mkety workspace hub components"
```

---

### Task 4: Convert Project Detail Page into Workspace Hub

**Files:**
- Modify: `src/app/(tenant)/t/[tenant]/projects/[project]/page.tsx`

**Interfaces:**
- Consumes: `requireProjectAccess` from Task 2.
- Consumes: `projectWorkspaces` and `WorkspaceHub` from Tasks 1 and 3.

- [ ] **Step 1: Replace duplicated access logic with helper and hub**

Modify `src/app/(tenant)/t/[tenant]/projects/[project]/page.tsx` so it:

- reads params
- calls `requireProjectAccess`
- returns safe status UI for non-ok status
- queries project agents only for a compact existing-resources section
- renders `<WorkspaceHub />`
- links existing agents to `/agents/[agent]`
- does not render inline Create AI Agent form

Expected shape:

```tsx
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { requireProjectAccess } from '@/features/projects/server/access';
import { projectWorkspaces } from '@/features/projects/workspaces/registry';
import { WorkspaceHub } from '@/features/projects/workspaces/WorkspaceHub';
import { db } from '@/shared/db';
import { agents } from '@/shared/db/schema';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });

  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  const projectAgents = await db.query.agents.findMany({
    where: eq(agents.projectId, access.project.id),
    orderBy: [desc(agents.createdAt)],
    limit: 4,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <WorkspaceHub projectName={access.project.name} projectSlug={projectSlug} tenantSlug={tenantSlug} workspaces={projectWorkspaces} />

      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Current AI agents</h2>
            <p className="mt-1 text-sm text-muted-foreground">Existing agents remain available through the AI workspace.</p>
          </div>
          <Link href={`/t/${tenantSlug}/projects/${projectSlug}/ai`} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/60">
            Open AI Workspace
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {projectAgents.map((agent) => (
            <Link key={agent.id} href={`/t/${tenantSlug}/projects/${projectSlug}/agents/${agent.slug}`} className="rounded-lg border p-4 hover:bg-muted/40">
              <div className="font-medium">{agent.name}</div>
              <p className="mt-1 text-xs text-muted-foreground">{agent.status}</p>
            </Link>
          ))}
          {projectAgents.length === 0 && <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">No agents yet. Open AI Workspace to create one.</div>}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run type-check**

Run:

```bash
pnpm type-check
```

Expected: PASS. If Drizzle `limit` is not supported in the relation query shape, remove `limit` and slice in memory with `.slice(0, 4)`.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(tenant)/t/[tenant]/projects/[project]/page.tsx'
git commit -m "feat: convert project page to Mkety workspace hub"
```

---

### Task 5: Add Workspace Route Shell Pages

**Files:**
- Create: `src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/projects/[project]/deploy/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/projects/[project]/solutions/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/projects/[project]/trading/page.tsx`

**Interfaces:**
- Consumes: `requireProjectAccess`.
- Consumes: `getProjectWorkspaceByKey`.
- Consumes: `WorkspaceShell` and `WorkspaceEmptyState`.

- [ ] **Step 1: Add AI workspace page**

Create `src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx`:

```tsx
import Link from 'next/link';

import { requireProjectAccess } from '@/features/projects/server/access';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function AiWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  return (
    <WorkspaceShell projectName={access.project.name} projectSlug={projectSlug} tenantSlug={tenantSlug} workspace={getProjectWorkspaceByKey('ai')}>
      <section className="grid gap-4 md:grid-cols-2">
        <Link href={`/t/${tenantSlug}/projects/${projectSlug}/agents`} className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <h2 className="font-medium">Agents</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create, test, and manage project AI agents.</p>
        </Link>
        <Link href={`/t/${tenantSlug}/projects/${projectSlug}/knowledge`} className="rounded-xl border bg-card p-5 hover:bg-muted/40">
          <h2 className="font-medium">Knowledge</h2>
          <p className="mt-2 text-sm text-muted-foreground">Connect project files and knowledge sources for AI systems.</p>
        </Link>
      </section>
    </WorkspaceShell>
  );
}
```

- [ ] **Step 2: Add Automation workspace page**

Create `src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx`:

```tsx
import { requireProjectAccess } from '@/features/projects/server/access';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function AutomationWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  return (
    <WorkspaceShell projectName={access.project.name} projectSlug={projectSlug} tenantSlug={tenantSlug} workspace={getProjectWorkspaceByKey('automation')}>
      <WorkspaceEmptyState title="Automation foundation" description="Automate will manage workflows, triggers, actions, webhooks, run history, retries, and failure handling for this project." />
    </WorkspaceShell>
  );
}
```

- [ ] **Step 3: Add Deploy workspace page**

Create `src/app/(tenant)/t/[tenant]/projects/[project]/deploy/page.tsx`:

```tsx
import { requireProjectAccess } from '@/features/projects/server/access';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function DeployWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  return (
    <WorkspaceShell projectName={access.project.name} projectSlug={projectSlug} tenantSlug={tenantSlug} workspace={getProjectWorkspaceByKey('deploy')}>
      <WorkspaceEmptyState title="Deployment foundation" description="Deploy will manage apps, websites, APIs, environments, domains, previews, production releases, and deployment history." />
    </WorkspaceShell>
  );
}
```

- [ ] **Step 4: Add SolutionHub workspace page**

Create `src/app/(tenant)/t/[tenant]/projects/[project]/solutions/page.tsx`:

```tsx
import { requireProjectAccess } from '@/features/projects/server/access';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function SolutionsWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  return (
    <WorkspaceShell projectName={access.project.name} projectSlug={projectSlug} tenantSlug={tenantSlug} workspace={getProjectWorkspaceByKey('solutions')}>
      <WorkspaceEmptyState title="SolutionHub foundation" description="SolutionHub will expose ready-made solutions, templates, blueprints, business systems, and enterprise implementation paths." />
    </WorkspaceShell>
  );
}
```

- [ ] **Step 5: Add Trading workspace page**

Create `src/app/(tenant)/t/[tenant]/projects/[project]/trading/page.tsx`:

```tsx
import { requireProjectAccess } from '@/features/projects/server/access';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function TradingWorkspacePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const access = await requireProjectAccess({ tenantSlug, projectSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  return (
    <WorkspaceShell projectName={access.project.name} projectSlug={projectSlug} tenantSlug={tenantSlug} workspace={getProjectWorkspaceByKey('trading')}>
      <WorkspaceEmptyState title="Enterprise trading systems" description="Trading remains a custom Mkety enterprise solution. This page does not create trading accounts, broker connections, signals, copy-trading settings, or execution records." />
    </WorkspaceShell>
  );
}
```

- [ ] **Step 6: Run type-check and build**

Run:

```bash
pnpm type-check
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(tenant)/t/[tenant]/projects/[project]/ai/page.tsx' 'src/app/(tenant)/t/[tenant]/projects/[project]/automation/page.tsx' 'src/app/(tenant)/t/[tenant]/projects/[project]/deploy/page.tsx' 'src/app/(tenant)/t/[tenant]/projects/[project]/solutions/page.tsx' 'src/app/(tenant)/t/[tenant]/projects/[project]/trading/page.tsx'
git commit -m "feat: add Mkety project workspace routes"
```

---

### Task 6: Optional Navigation Copy Tightening

**Files:**
- Modify only if needed: `src/shared/components/layout/nav/MyViewNav.tsx`

**Interfaces:**
- Consumes: existing navigation structure.
- Produces: clearer tenant navigation label, without broad restructure.

- [ ] **Step 1: Inspect current nav copy**

Run:

```bash
sed -n '1,220p' src/shared/components/layout/nav/MyViewNav.tsx
```

- [ ] **Step 2: Only patch if the nav points users away from the project hub**

If current copy already routes users to Projects clearly, do not modify this file.

If it still frames the product as only AI/agents, adjust the label to `Projects` or `Platform` while keeping href behavior unchanged.

- [ ] **Step 3: Run verification**

Run:

```bash
pnpm lint
pnpm type-check
```

Expected: PASS.

- [ ] **Step 4: Commit only if changed**

```bash
git add src/shared/components/layout/nav/MyViewNav.tsx
git commit -m "chore: align tenant nav with Mkety platform workspaces"
```

---

### Task 7: Full Verification and PR

**Files:**
- No product files unless CI exposes a real issue.
- Create PR from `feat/mkety-platform-core-workspaces` to `main`.

**Interfaces:**
- Consumes all tasks.
- Produces a PR with verified status.

- [ ] **Step 1: Run all local verification commands**

Run:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Expected: all PASS.

- [ ] **Step 2: Open PR**

PR title:

```text
Build: Mkety Platform core workspace shell
```

PR body:

```markdown
This PR starts the authenticated `app.mkety.com` Platform phase by converting project pages into a Mkety workspace hub and adding route shells for AI, Automate, Deploy, SolutionHub, and Trading/Enterprise.

## Implemented scope

- Adds a code-owned Mkety project workspace registry.
- Converts the project detail page into a Platform workspace hub.
- Adds shared workspace hub/shell/empty-state components.
- Adds project access helper for tenant membership and project ownership checks.
- Adds AI workspace entry route linking to existing Agents and Knowledge areas.
- Adds planned route shells for Automation, Deploy, and SolutionHub.
- Adds enterprise-gated Trading workspace shell without trading data tables or execution behavior.

## Important boundaries

- Mkety remains broader than AI.
- Trading is visible only as Custom/Enterprise in this branch.
- No trading-account, signal, broker, copy-trading, or execution records are created.
- No billing ledger/wallet money movement is implemented.
- No real deployment infrastructure automation is implemented.

## Verification

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```
```

- [ ] **Step 3: Watch CI**

Use GitHub Actions to confirm:

```text
Test ✅
Type-check ✅
Lint ✅
Build ✅
```

- [ ] **Step 4: Patch only confirmed failures**

If CI fails, fetch the exact job log and patch the smallest confirmed issue. Do not add new feature scope while fixing CI.

- [ ] **Step 5: Final status update**

Report:

```text
Branch
PR number
Latest head SHA
CI status
Implemented scope
Remaining next branch recommendation
```

---

## Self-Review

### Spec coverage

Covered:

- Workspace registry and stable keys.
- Project hub conversion.
- Route shells for AI, Automation, Deploy, SolutionHub, and Trading.
- Access control reuse.
- Trading enterprise boundary.
- Testing and CI verification.
- Non-goals for deployment, billing, Auth Gateway, Academy, and real trading data.

### Placeholder scan

No `TBD`, `TODO`, or unspecified implementation placeholders are present. Optional navigation tightening is bounded by an explicit inspect-and-skip rule.

### Type consistency

The plan consistently uses:

- `WorkspaceKey`
- `WorkspaceAvailability`
- `ProjectWorkspaceDefinition`
- `projectWorkspaces`
- `getProjectWorkspaceByKey`
- `requireProjectAccess`
- `WorkspaceHub`
- `WorkspaceShell`
- `WorkspaceEmptyState`

These names match across tasks.
