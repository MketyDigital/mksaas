import Link from 'next/link';
import type { ReactNode } from 'react';

import { projectWorkspaces } from './registry';
import type { ProjectWorkspaceDefinition } from './types';

export function WorkspaceShell({
  children,
  projectName,
  projectSlug,
  tenantSlug,
  workspace,
}: {
  tenantSlug: string;
  projectSlug: string;
  projectName: string;
  workspace: ProjectWorkspaceDefinition;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <header className="rounded-2xl border bg-card p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/t/${tenantSlug}/projects/${projectSlug}`} className="font-medium hover:text-foreground">
            {projectName}
          </Link>
          <span>/</span>
          <span>{workspace.shortTitle}</span>
        </div>
        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Mkety Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{workspace.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{workspace.description}</p>
          </div>
          <span className="w-fit rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">{workspace.statusLabel}</span>
        </div>
        {workspace.protectedReason && <p className="mt-5 rounded-xl bg-muted/70 p-4 text-sm leading-6 text-muted-foreground">{workspace.protectedReason}</p>}
      </header>

      <nav aria-label="Project workspaces" className="rounded-2xl border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          {projectWorkspaces.map((item) => {
            const isActive = item.key === workspace.key;
            return (
              <Link
                key={item.key}
                href={`/t/${tenantSlug}/projects/${projectSlug}/${item.hrefSegment}`}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'rounded-full border px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                ].join(' ')}
              >
                {item.shortTitle}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </main>
  );
}
