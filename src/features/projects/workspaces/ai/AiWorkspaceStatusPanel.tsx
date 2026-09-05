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
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Agents and Knowledge are available. Tools, Runs, Versions, and Publish stay staged until backend rules are ready.
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-medium text-muted-foreground">Agents</p>
        <p className="mt-2 text-2xl font-semibold">
          {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Project-scoped AI agents</p>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-sm font-medium text-muted-foreground">Knowledge</p>
        <p className="mt-2 text-sm font-medium">{knowledgeStatus}</p>
        <p className="mt-2 text-xs text-muted-foreground">{canManage ? 'Management available' : 'Read-only access'}</p>
      </div>
    </section>
  );
}
