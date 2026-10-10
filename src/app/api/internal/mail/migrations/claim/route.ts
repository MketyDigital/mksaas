import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { decryptImapCredential, normalizeImapEndpoint } from '@/features/mail/server/migration-credentials';
import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMigrationRuns } from '@/shared/db/schema';

function authorized(request: Request) {
  const secret = getMailInternalSecret();
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  return withRequestDatabase(async () => {
    const body = (await request.json().catch(() => null)) as { runId?: string } | null;
    const runId = String(body?.runId || '');
    if (!/^[0-9a-f-]{36}$/i.test(runId)) return NextResponse.json({ ok: false }, { status: 400 });
    const result = await db.transaction(async (tx) => {
      const [run] = await tx
        .select()
        .from(mailMigrationRuns)
        .where(and(eq(mailMigrationRuns.id, runId), inArray(mailMigrationRuns.status, ['queued', 'running'])))
        .for('update')
        .limit(1);
      if (!run || run.sourceType !== 'imap' || !run.sourceHost || run.sourcePort !== 993 || !run.encryptedCredential)
        return null;
      const host = normalizeImapEndpoint(run.sourceHost, run.sourcePort);
      const credential = await decryptImapCredential(run.encryptedCredential);
      if (run.status === 'queued') {
        await tx
          .update(mailMigrationRuns)
          .set({ status: 'running', startedAt: run.startedAt ?? new Date(), updatedAt: new Date() })
          .where(and(eq(mailMigrationRuns.id, runId), eq(mailMigrationRuns.tenantId, run.tenantId)));
      }
      return {
        id: run.id,
        sourceMailboxAddress: run.sourceMailboxAddress,
        destinationMailboxId: run.destinationMailboxId,
        host,
        port: 993,
        username: credential.username,
        password: credential.password,
        sourceCursor: run.sourceCursor,
      };
    });
    return result
      ? NextResponse.json({ ok: true, run: result }, { headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.json({ ok: false }, { status: 404 });
  });
}
