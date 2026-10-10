import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { parseImportedMessage } from '@/features/mail/server/migration-import-core';
import { importMessageOnce } from '@/features/mail/server/migration-import-store';
import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMigrationRuns } from '@/shared/db/schema';

function authorized(request: Request) {
  const secret = getMailInternalSecret();
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

function readJsonHeader(request: Request, name: string, limit: number) {
  try {
    const value = JSON.parse(request.headers.get(name) || '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, limit) : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  return withRequestDatabase(async () => {
    const runId = String(new URL(request.url).searchParams.get('runId') || '');
    const folderPath = request.headers.get('x-mkety-source-folder') || '';
    const uid = request.headers.get('x-mkety-source-uid') || '';
    const uidValidity = request.headers.get('x-mkety-source-uidvalidity') || '';
    if (
      !/^[0-9a-f-]{36}$/i.test(runId) ||
      !folderPath ||
      folderPath.length > 1024 ||
      !/^\d{1,20}$/.test(uid) ||
      !/^\d{1,128}$/.test(uidValidity)
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const run = await db.query.mailMigrationRuns.findFirst({
      where: and(eq(mailMigrationRuns.id, runId), eq(mailMigrationRuns.status, 'running')),
    });
    if (!run || run.sourceType !== 'imap') return NextResponse.json({ ok: false }, { status: 404 });
    const raw = new Uint8Array(await request.arrayBuffer());
    if (!raw.byteLength || raw.byteLength > 25_000_000) return NextResponse.json({ ok: false }, { status: 413 });
    try {
      const parsed = await parseImportedMessage(raw, {
        folderPath,
        flags: readJsonHeader(request, 'x-mkety-source-flags', 32),
        specialUse: readJsonHeader(request, 'x-mkety-source-special-use', 16),
      });
      const result = await importMessageOnce({
        tenantId: run.tenantId,
        mailboxId: run.destinationMailboxId,
        runId: run.id,
        parsed,
        sourceUid: uid,
        sourceUidValidity: uidValidity,
      });
      await db
        .update(mailMigrationRuns)
        .set({
          totalMessages: sql`${mailMigrationRuns.totalMessages} + 1`,
          skippedMessages: result.imported
            ? mailMigrationRuns.skippedMessages
            : sql`${mailMigrationRuns.skippedMessages} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(mailMigrationRuns.id, run.id), eq(mailMigrationRuns.status, 'running')));
      return NextResponse.json({ ok: true, imported: result.imported, messageId: result.messageId });
    } catch {
      await db
        .update(mailMigrationRuns)
        .set({
          failedMessages: sql`${mailMigrationRuns.failedMessages} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(mailMigrationRuns.id, run.id), eq(mailMigrationRuns.status, 'running')));
      return NextResponse.json({ ok: false, error: 'message_import_failed' }, { status: 422 });
    }
  });
}
