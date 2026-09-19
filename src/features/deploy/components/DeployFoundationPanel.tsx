import { createDeployApplication, createDeployEnvironment, deployCloudflareCandidate } from '@/features/deploy/actions';
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
        <div
          className="rounded-2xl border bg-card p-4 text-sm"
          role="status"
        >
          {candidateOutcome === 'completed'
            ? 'Candidate deployment completed. The run is recorded in deployment history below.'
            : 'Candidate deployment could not be completed. No production environment was changed.'}
        </div>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border bg-card p-5" aria-labelledby="candidate-deploy-heading">
          <div>
            <h3 className="font-semibold" id="candidate-deploy-heading">Deploy non-production candidate</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Creates an isolated workers.dev proof deployment from a Mkety-controlled artifact. Production environments, custom domains and DNS are not changed.
            </p>
          </div>

          {canDeployCandidate ? (
            <div className="mt-4 space-y-4">
              {state.environments.filter((environment) => !environment.protected && environment.kind !== 'production').length ? (
                state.environments
                  .filter((environment) => !environment.protected && environment.kind !== 'production')
                  .map((environment) => (
                    <form action={deployCloudflareCandidate} className="grid gap-3 rounded-xl border bg-background p-4 md:grid-cols-[1fr_1fr_auto]" key={environment.id}>
                      <input name="tenantSlug" type="hidden" value={tenantSlug} />
                      <input name="projectSlug" type="hidden" value={projectSlug} />
                      <input name="environmentId" type="hidden" value={environment.id} />
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">{environmentNameById.get(environment.id) ?? environment.name}</span>
                        <input
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          name="releaseRef"
                          placeholder="Release reference"
                          required
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Source reference</span>
                        <input
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          name="sourceRef"
                          placeholder="Optional branch or commit"
                        />
                      </label>
                      <button className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" type="submit">
                        Deploy candidate
                      </button>
                    </form>
                  ))
              ) : (
                <p className="text-sm text-muted-foreground">Add a development, preview or staging environment first.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Candidate deployment requires Deploy Workspace access and project manager permissions.
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

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="deployment-history-heading">
        <div>
          <h3 className="font-semibold" id="deployment-history-heading">Deployment history</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Audited candidate release history. Customer-triggered execution is limited to non-production isolated workers.dev candidates.
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
