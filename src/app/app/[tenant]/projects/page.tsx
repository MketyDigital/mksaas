import Link from 'next/link';

import { createProject, getProjectsForTenant } from '@/features/projects/actions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return <div className="p-8">Workspace not found.</div>;
  const projects = await getProjectsForTenant(tenantSlug);

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build and manage AI apps, agents and future automations inside {tenant.name}.</p>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-medium">Create project</h2>
        <form action={createProject} className="mt-4 grid gap-3 md:grid-cols-4">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input name="name" required placeholder="Project name" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input name="slug" placeholder="Slug (optional)" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input name="description" placeholder="Description" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create project</button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/t/${tenantSlug}/projects/${project.slug}`} className="rounded-xl border bg-card p-5 transition hover:border-primary">
            <div className="font-medium">{project.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{project.type}</div>
            {project.description && <p className="mt-3 text-sm text-muted-foreground">{project.description}</p>}
          </Link>
        ))}
        {projects.length === 0 && <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">No projects yet. Create your first project above.</div>}
      </section>
    </main>
  );
}
