import { and, desc, eq, ne } from 'drizzle-orm';

import {
  activateFirstPartyMailRootRouting,
  completeFirstPartyMailCutover,
  prepareFirstPartyMailTestRoutes,
  recordFirstPartyMailCutoverCheck,
  removeFirstPartyMailTestRoutes,
  rollbackFirstPartyMailRootRouting,
} from '@/features/mail/server/mail-cutover-actions';
import { REQUIRED_ROOT_MAILBOXES } from '@/features/mail/server/mail-cutover-readiness';
import { getFirstPartyMailTenantId } from '@/features/mail/server/runtime-config';
import { Button } from '@/shared/components/ui';
import { db } from '@/shared/db/cloudflare';
import {
  mailDomainCutoverChecks,
  mailDomainCutovers,
  mailDomains,
  mailMailboxes,
  mailMigrationRuns,
} from '@/shared/db/schema';

const checks = [
  {
    name: 'temporary_inbound',
    title: 'Temporary inbound test',
    phase: 'before',
    detail: 'Send a real message to every listed root mailbox through temporary test routes.',
  },
  {
    name: 'outbound_acceptance',
    title: 'Outbound test',
    phase: 'before',
    detail: 'Send and receive replies from each mailbox and verify SPF, DKIM and DMARC.',
  },
  {
    name: 'rollback_rehearsal',
    title: 'Rollback rehearsal',
    phase: 'before',
    detail: 'Capture current root MX/TXT values and rehearse restoring Zoho MX before activation.',
  },
  {
    name: 'post_cutover_inbound',
    title: 'Live inbound test',
    phase: 'after',
    detail: 'After activation, receive a real message at every root mailbox.',
  },
  {
    name: 'hello_final_delta',
    title: 'Final hello delta',
    phase: 'after',
    detail: 'Run an IMAP delta for hello@mkety.com and enter the completed migration run ID as evidence.',
  },
] as const;

export async function FirstPartyMailCutoverPanel({ tenant }: { tenant: string }) {
  const tenantId = getFirstPartyMailTenantId().trim();
  const domain = tenantId
    ? await db.query.mailDomains.findFirst({
        where: and(eq(mailDomains.tenantId, tenantId), eq(mailDomains.domain, 'mkety.com')),
      })
    : null;
  const [cutover, imports] = domain
    ? await Promise.all([
        db.query.mailDomainCutovers.findFirst({
          where: and(eq(mailDomainCutovers.tenantId, tenantId), eq(mailDomainCutovers.domainId, domain.id)),
        }),
        db.query.mailMigrationRuns.findMany({
          where: and(
            eq(mailMigrationRuns.tenantId, tenantId),
            eq(mailMigrationRuns.sourceMailboxAddress, 'hello@mkety.com'),
          ),
          orderBy: (table) => [desc(table.createdAt)],
          limit: 5,
        }),
      ])
    : [null, []];
  const mailboxRows = domain
    ? await db
        .select({ id: mailMailboxes.id, localPart: mailMailboxes.localPart })
        .from(mailMailboxes)
        .where(
          and(
            eq(mailMailboxes.tenantId, tenantId),
            eq(mailMailboxes.domainId, domain.id),
            eq(mailMailboxes.status, 'active'),
            ne(mailMailboxes.type, 'alias'),
          ),
        )
    : [];
  const checksSaved = cutover
    ? await db.query.mailDomainCutoverChecks.findMany({
        where: and(eq(mailDomainCutoverChecks.tenantId, tenantId), eq(mailDomainCutoverChecks.cutoverId, cutover.id)),
      })
    : [];
  const checkByName = new Map(checksSaved.map((item) => [item.checkName, item]));
  const addresses = mailboxRows.map((row) => `${row.localPart}@mkety.com`).sort();

  return (
    <div className="space-y-5 rounded-xl border p-4 text-sm">
      <div>
        <h3 className="font-semibold">Full-domain migration and cutover</h3>
        <p className="mt-1 text-muted-foreground">
          Zoho currently has one mailbox, <code>hello@mkety.com</code>. Import it once into Mkety hello; aliases are
          already in that source history. Root MX stays unchanged until every acceptance gate passes.
        </p>
      </div>
      <p>
        <strong>State:</strong> {cutover?.state ?? 'inventory'} · <strong>Root routing:</strong>{' '}
        {domain?.routingEnabled ? 'active' : 'not active'}
      </p>
      <p className="text-xs text-muted-foreground"><strong>Root sending authentication:</strong> {domain?.sendingEnabled ? `enabled · SPF ${domain.spfStatus} · DKIM ${domain.dkimStatus} · DMARC ${domain.dmarcStatus}` : 'not ready'}</p>
      <div className="space-y-1">
        <p className="font-medium">Required independent root mailboxes</p>
        <p className="text-muted-foreground">
          {addresses.length ? addresses.join(', ') : 'No active root mailboxes found.'}
        </p>
        <p className="text-xs text-muted-foreground">
          Minimum set: {REQUIRED_ROOT_MAILBOXES.join(', ')}. Additional active root mailboxes will be included in
          send/receive checks.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        <p className="font-semibold">Temporary inbound test routes</p>
        <p className="text-xs text-muted-foreground">
          These exact Cloudflare routes are on <code>mail.mkety.com</code> only and map to the root mailboxes. Send test
          messages directly to them; no Zoho forwarding is involved.
        </p>
        <p className="text-xs text-muted-foreground">
          {addresses.map((address) => `test-mkety-${address.split('@')[0].slice(0, 100)}@mail.mkety.com`).join(', ') ||
            'Provision active root mailboxes to prepare test routes.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={prepareFirstPartyMailTestRoutes.bind(null, tenant)}>
            <Button size="sm" type="submit" variant="outline">
              Prepare test routes
            </Button>
          </form>
          <form action={removeFirstPartyMailTestRoutes.bind(null, tenant)}>
            <Button size="sm" type="submit" variant="outline">
              Remove test routes
            </Button>
          </form>
        </div>
      </div>
      {imports.length ? (
        <div className="space-y-1">
          <p className="font-medium">Recent hello imports</p>
          {imports.map((run) => (
            <p className="font-mono text-xs text-muted-foreground" key={run.id}>
              {run.id} · {run.mode} · {run.status} · {run.importedMessages} imported / {run.failedMessages} failed
            </p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {checks.map((check) => (
          <form
            action={recordFirstPartyMailCutoverCheck.bind(null, tenant)}
            className="space-y-2 rounded-lg border p-3"
            key={check.name}
          >
            <input name="checkName" type="hidden" value={check.name} />
            <p className="font-semibold">
              {check.title}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                {check.phase === 'before' ? 'before root MX' : 'after root MX'}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{check.detail}</p>
            <label className="grid gap-1 text-xs">
              Evidence reference
              <input
                className="rounded-lg border bg-background px-2 py-1.5"
                name="evidenceRef"
                placeholder={
                  check.name === 'hello_final_delta' ? 'Completed migration run ID' : 'Test report or ticket reference'
                }
                required
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input name="passed" type="checkbox" />I verified this check and its evidence.
            </label>
            <Button size="sm" type="submit" variant="outline">
              Record check
            </Button>
            {checkByName.get(check.name) ? (
              <p className="text-xs text-muted-foreground">
                Saved: {checkByName.get(check.name)?.passed ? 'passed' : 'failed'} ·{' '}
                {checkByName.get(check.name)?.evidenceRef}
              </p>
            ) : null}
          </form>
        ))}
      </div>
      <form
        action={activateFirstPartyMailRootRouting.bind(null, tenant)}
        className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3"
      >
        <p className="font-semibold">Activate root mail routing</p>
        <p className="text-xs text-muted-foreground">
          This changes Cloudflare Email Routing and root MX. It is enabled only after inventory, initial hello import,
          authenticated sending, per-address inbound/outbound tests, and rollback evidence all pass. Snapshot of current
          root MX/TXT records is saved before activation.
        </p>
        <label className="grid max-w-sm gap-1 text-xs">
          Type <code>CUTOVER mkety.com</code> to authorize
          <input autoComplete="off" className="rounded-lg border bg-background px-2 py-1.5" name="confirm" required />
        </label>
        <Button type="submit" variant="destructive">
          Activate after all checks pass
        </Button>
      </form>
      {cutover?.state === 'activated' ? (
        <form action={completeFirstPartyMailCutover.bind(null, tenant)}>
          <Button type="submit">Mark cutover complete after final tests</Button>
        </form>
      ) : null}
      {cutover && ['activated', 'needs_reconciliation'].includes(cutover.state) ? (
        <form
          action={rollbackFirstPartyMailRootRouting.bind(null, tenant)}
          className="space-y-2 rounded-lg border border-destructive/30 p-3"
        >
          <p className="font-semibold">Restore the saved Zoho MX and TXT values</p>
          <p className="text-xs text-muted-foreground">
            Rollback disables Cloudflare Email Routing, restores the exact saved root MX/TXT snapshot, and verifies
            public MX before changing Mkety's routing state.
          </p>
          <label className="grid max-w-sm gap-1 text-xs">
            Type <code>ROLLBACK mkety.com</code>
            <input autoComplete="off" className="rounded-lg border bg-background px-2 py-1.5" name="confirm" required />
          </label>
          <Button type="submit" variant="destructive">
            Restore previous root mail routing
          </Button>
        </form>
      ) : null}
    </div>
  );
}
