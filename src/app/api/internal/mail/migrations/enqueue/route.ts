import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { publishMailMigrationQueue } from '@/features/mail/server/cloudflare';
import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMigrationRuns } from '@/shared/db/schema';

export async function POST(request: Request) {
  const secret = getMailInternalSecret();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { runId?: string; kind?: string } | null;
  const runId = String(body?.runId || '');
  const kind = body?.kind === 'archive' ? 'archive' : undefined;
  if (!/^[0-9a-f-]{36}$/i.test(runId) || (body?.kind !== undefined && body.kind !== 'archive')) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return withRequestDatabase(async () => {
    const run = await db.query.mailMigrationRuns.findFirst({
      where: and(eq(mailMigrationRuns.id, runId), eq(mailMigrationRuns.status, 'queued')),
    });
    if (!run || (kind ? run.sourceType !== 'archive' : run.sourceType !== 'imap')) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    try {
      await publishMailMigrationQueue(runId, kind);
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  });
}
