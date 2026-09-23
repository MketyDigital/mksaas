import {
  createDeployApplication,
  createDeployEnvironment,
  createDeploymentRequest,
  executeApprovedDeploymentRequest,
} from '@/features/deploy/actions';
import type { DeployFoundationState } from '@/features/deploy/server/queries';

interface DeployFoundationPanelProps {
  canManage: boolean;
  canDeployCandidate: boolean;
  candidateOutcome?: 'completed' | 'failed';
  projectSlug: string;
  state: DeployFoundationState;
  tenantSlug: string;
}

export function DeployFoundationPanel({
  canManage,
  canDeployCandidate,
  candidateOutcome,
  projectSlug,
  state,
  tenantSlug,
}: DeployFoundationPanelProps) {
  const applicationNameById = new Map(state.applications.map((application) => [application.id, application.name]));
  const environmentNameById = new Map(state.environments.map((environment) => [environment.id, environment.name]));
  const requestableEnvironments = state.environments.filter(
    (environment) => !environment.protected && environment.kind !== 'production',
  );

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form action={createDeployApplication} className="space-y-3 rounded-2xl border bg-card p-5">
            <div>
              <h3 className="font-semibold">Add application</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create metadata only. No infrastructure is provisioned.
              </p>
            </div>
            <input name="tenantSlug" type="hidden" value={tenantSlug} />
            <input name="projectSlug" type="hidden" value={projectSlug} />
            <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" name="name" placeholder="Application name" required />
            <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" name="slug" placeholder="Slug (optional)" />
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" defaultValue="web" name="kind">
              <option value="web">Web app</option>
              <option value="api">API</option>
              <option value="service">Service</option>
            </select>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
              Add application
            </button>
          </form>

          <form action={createDeployEnvironment} className="space-y-3 rounded-2xl border bg-card p-5">
            <div>
              <h3 className="font-semibold">Add environment</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Production metadata is protected; this does not deploy anything.
              </p>
            </div>
            <input name="tenantSlug" type="hidden" value={tenantSlug} />
            <input name="projectSlug" type="hidden" value={projectSlug} />
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" name="applicationId" required>
              <option value="">Choose application</option>
              {state.applications.map((application) => (
                <option key={application.id} value={application.id}>{application.name}</option>
              ))}
            </select>
            <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" name="name" placeholder="Environment name" required />
            <input className="w-full rounded-md border bg-background px-3 py-2 text-sm" name="slug" placeholder="Slug (optional)" />
            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" defaultValue="development" name="kind">
              <option value="development">Development</option>
              <option value="preview">Preview</option>
              <option value="staging">Staging</option>
              <option value="production">Production (protected)</option>
            </select>
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={state.applications.length === 0}
              type="submit"
            >
              Add environment
            </button>
          </form>
        </div>
      )}

      {candidateOutcome ? (
        <div className="rounded-2xl border bg-card p-4 text-sm" role="status">
          {candidateOutcome === 'completed'
            ? 'Approved candidate deployment completed. The run is recorded in deployment history below.'
            : 'Approved candidate deployment could not be completed. No production environment was changed.'}
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border bg-card p-5" aria-labelledby="candidate-request-heading">
          <div>
            <h3 className="font-semibold" id="candidate-request-heading">Request non-production candidate</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A manager submits the exact environment and release/source references for Platform Control approval. Approval authorizes one isolated workers.dev proof execution only.
            </p>
          </div>

          {canDeployCandidate ? (
            <form action={createDeploymentRequest} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <input name="tenantSlug" type="hidden" value={tenantSlug} />
              <input name="projectSlug" type="hidden" value={projectSlug} />
              <select className="rounded-md border bg-background px-3 py-2 text-sm" name="environmentId" required>
                <option value="">Choose non-production environment</option>
                {requestableEnvironments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {applicationNameById.get(environment.applicationId) ?? 'Application'} · {environment.name}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border bg-background px-3 py-2 text-sm"
                name="releaseRef"
                placeholder="Release reference"
                required
              />
              <input
                className="rounded-md border bg-background px-3 py-2 text-sm"
                name="sourceRef"
                placeholder="Source reference (optional)"
              />
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                disabled={requestableEnvironments.length === 0}
                type="submit"
              >
                Request approval
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Candidate requests require Deploy Workspace access and project manager permissions.
            </p>
          )}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Deploy foundation records">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Applications</h3>
          <div className="mt-4 space-y-3">
            {state.applications.length ? state.applications.map((application) => (
              <div className="rounded-xl border bg-background p-3" key={application.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{application.name}</span>
                  <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{application.kind}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{application.slug}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No Deploy applications yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-semibold">Environments</h3>
          <div className="mt-4 space-y-3">
            {state.environments.length ? state.environments.map((environment) => (
              <div className="rounded-xl border bg-background p-3" key={environment.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{environment.name}</span>
                  <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
                    {environment.protected ? 'Protected' : environment.kind}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {applicationNameById.get(environment.applicationId) ?? 'Application'} · {environment.slug}
                </p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No environments yet.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="deployment-requests-heading">
        <div>
          <h3 className="font-semibold" id="deployment-requests-heading">Deployment requests</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Approved requests can be executed once by a project manager while Deploy entitlement remains active. Production, DNS and custom domains stay blocked.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {state.deploymentRequests.length ? state.deploymentRequests.map((request) => (
            <div className="grid gap-3 rounded-xl border bg-background p-3 text-sm md:grid-cols-[1fr_1fr_1fr_1fr_auto]" key={request.id}>
              <span>{applicationNameById.get(request.applicationId) ?? 'Application'}</span>
              <span>{environmentNameById.get(request.environmentId) ?? 'Environment'}</span>
              <span className="capitalize">{request.status}</span>
              <span className="text-muted-foreground">{request.releaseRef}</span>
              {canDeployCandidate && request.status === 'approved' && !request.executionDeploymentId ? (
                <form action={executeApprovedDeploymentRequest}>
                  <input name="tenantSlug" type="hidden" value={tenantSlug} />
                  <input name="projectSlug" type="hidden" value={projectSlug} />
                  <input name="requestId" type="hidden" value={request.id} />
                  <button className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" type="submit">
                    Execute approved candidate
                  </button>
                </form>
              ) : <span className="text-xs text-muted-foreground">{request.executionDeploymentId ? 'Execution linked' : 'Awaiting action'}</span>}
            </div>
          )) : <p className="text-sm text-muted-foreground">No deployment approval requests have been recorded.</p>}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="deployment-history-heading">
        <div>
          <h3 className="font-semibold" id="deployment-history-heading">Deployment history</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Audited candidate release history. Customer execution is limited to approved non-production isolated workers.dev candidates.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          {state.deploymentHistory.length ? state.deploymentHistory.map((deployment) => (
            <div className="grid gap-2 rounded-xl border bg-background p-3 text-sm md:grid-cols-4" key={deployment.id}>
              <span>{applicationNameById.get(deployment.applicationId) ?? 'Application'}</span>
              <span>{environmentNameById.get(deployment.environmentId) ?? 'Environment'}</span>
              <span className="capitalize">{deployment.status}</span>
              <span className="text-muted-foreground">{deployment.releaseRef ?? 'No release reference'}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">No deployment runs have been recorded.</p>}
        </div>
      </section>
    </div>
  );
}
