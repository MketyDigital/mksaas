import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';

import { createKnowledgeDocument } from '@/features/ai/lib/knowledge-actions';
import { db } from '@/shared/db';
import { knowledgeDocuments, projects, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant: tenantSlug, project: projectSlug } = await params;
  const session = await auth();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!session?.user?.id || !tenant) return <div className="p-8">Workspace not found.</div>;

  const membership = await db.query.tenantMemberships.findFirst({ where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)) });
  if (!membership) return <div className="p-8">Forbidden.</div>;

  const project = await db.query.projects.findFirst({ where: and(eq(projects.tenantId, tenant.id), eq(projects.slug, projectSlug)) });
  if (!project) return <div className="p-8">Project not found.</div>;

  const documents = await db.query.knowledgeDocuments.findMany({ where: and(eq(knowledgeDocuments.tenantId, tenant.id), eq(knowledgeDocuments.projectId, project.id)), orderBy: [desc(knowledgeDocuments.createdAt)] });
  const canManage = membership.role === 'admin' || membership.role === 'manager';

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Project · Knowledge</p><h1 className="text-2xl font-semibold">{project.name} knowledge</h1><p className="mt-1 text-sm text-muted-foreground">Add trusted project information for agents to retrieve at runtime.</p></div>
        <Link href={`/t/${tenantSlug}/projects/${projectSlug}`} className="rounded-md border px-4 py-2 text-sm">Back to project</Link>
      </div>

      {canManage && (
        <section className="rounded-xl border bg-card p-6">
          <h2 className="font-medium">Add text knowledge</h2>
          <p className="mt-1 text-sm text-muted-foreground">Paste documentation, FAQs, product information, policies, or other source material.</p>
          <form action={createKnowledgeDocument} className="mt-5 grid gap-4">
            <input type="hidden" name="tenantSlug" value={tenantSlug} /><input type="hidden" name="projectSlug" value={projectSlug} />
            <input name="name" required placeholder="Document name" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <input name="description" placeholder="Description (optional)" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <textarea name="text" required rows={12} placeholder="Paste your knowledge here…" className="rounded-md border bg-background px-3 py-2 text-sm" />
            <button className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Process knowledge</button>
          </form>
        </section>
      )}

      <section>
        <h2 className="font-medium">Knowledge sources</h2>
        <div className="mt-4 space-y-3">
          {documents.map((document) => (
            <div key={document.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-4"><div className="font-medium">{document.name}</div><span className="rounded-full border px-2 py-1 text-xs">{document.status}</span></div>
              {document.description && <p className="mt-2 text-sm text-muted-foreground">{document.description}</p>}
              <p className="mt-3 text-xs text-muted-foreground">{document.chunkCount} chunks · {document.sourceType}</p>
            </div>
          ))}
          {documents.length === 0 && <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No knowledge sources yet.</div>}
        </div>
      </section>
    </main>
  );
}
