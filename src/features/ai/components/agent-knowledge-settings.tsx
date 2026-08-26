import { saveAgentKnowledge } from '../lib/agent-tools-actions';

type KnowledgeOption = { id: string; name: string; description: string | null; status: string; selected: boolean };

export function AgentKnowledgeSettings({ tenantSlug, projectSlug, agentId, documents }: { tenantSlug: string; projectSlug: string; agentId: string; documents: KnowledgeOption[] }) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <div><h2 className="font-medium">Knowledge</h2><p className="mt-1 text-sm text-muted-foreground">Choose which project knowledge this agent can retrieve.</p></div>
      <form action={saveAgentKnowledge} className="mt-5 space-y-4">
        <input type="hidden" name="tenantSlug" value={tenantSlug} /><input type="hidden" name="projectSlug" value={projectSlug} /><input type="hidden" name="agentId" value={agentId} />
        {documents.length ? <div className="space-y-2">{documents.map((doc) => <label key={doc.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><input type="checkbox" name="documentId" value={doc.id} defaultChecked={doc.selected} disabled={doc.status !== 'ready'} className="mt-1" /><span><span className="block text-sm font-medium">{doc.name}</span>{doc.description && <span className="block text-xs text-muted-foreground">{doc.description}</span>}<span className="mt-1 block text-xs text-muted-foreground">{doc.status}</span></span></label>)}</div> : <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No project knowledge sources available. Add one from the project Knowledge page.</div>}
        <button disabled={!documents.length} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save knowledge access</button>
      </form>
    </section>
  );
}
