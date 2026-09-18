import { reviewDeploymentRequest } from '@/features/deploy/request-actions';
import type { DeploymentApprovalRow } from '@/features/deploy/server/request-queries';

interface DeploymentApprovalQueueProps {
  rows: DeploymentApprovalRow[];
  tenantSlug: string;
}

export function DeploymentApprovalQueue({ rows, tenantSlug }: DeploymentApprovalQueueProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.02] p-5">
      <div>
        <h2 className="text-lg font-semibold">Pending deployment approvals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approval records intent and reviewer identity only. Provider execution remains server-controlled and production stays blocked.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deployment requests are waiting for review.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div className="rounded-xl border bg-background p-4" key={row.id}>
              <div className="grid gap-2 text-sm md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                  <p className="font-medium">{row.projectName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Application</p>
                  <p className="font-medium">{row.applicationName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Environment</p>
                  <p className="font-medium">{row.environmentName}</p>
                  <p className="text-xs text-muted-foreground">{row.environmentKind}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested</p>
                  <p className="font-medium">{row.requestedAt.toISOString()}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p>Source: {row.sourceRef ?? 'not supplied'}</p>
                <p>Release: {row.releaseRef ?? 'not supplied'}</p>
              </div>

              <form action={reviewDeploymentRequest} className="mt-4 space-y-3">
                <input name="tenantSlug" type="hidden" value={tenantSlug} />
                <input name="requestId" type="hidden" value={row.id} />
                <input
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  maxLength={500}
                  name="reviewNote"
                  placeholder="Review note (optional)"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    name="decision"
                    type="submit"
                    value="approved"
                  >
                    Approve request
                  </button>
                  <button
                    className="rounded-md border px-4 py-2 text-sm font-medium"
                    name="decision"
                    type="submit"
                    value="rejected"
                  >
                    Reject request
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
