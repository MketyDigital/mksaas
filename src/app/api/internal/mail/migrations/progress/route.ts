import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { mailMigrationRuns } from '@/shared/db/schema';

type CursorFolder = { uidValidity: string; lastUid: string };

function authorized(request: Request) {
  const secret = getMailInternalSecret();
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

function safeCursor(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('migration_cursor_invalid');
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 500) throw new Error('migration_cursor_invalid');
  const result: Record<string, CursorFolder> = {};
  for (const [folder, cursor] of entries) {
    const item = cursor as Partial<CursorFolder> | null;
    if (
      !folder ||
      folder.length > 1024 ||
      !item ||
      !/^\d{1,128}$/.test(String(item.uidValidity || '')) ||
      !/^\d{1,20}$/.test(String(item.lastUid || ''))
    ) {
      throw new Error('migration_cursor_invalid');
    }
    result[folder] = { uidValidity: String(item.uidValidity), lastUid: String(item.lastUid) };
  }
  return result;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  return withRequestDatabase(async () => {
    const body = (await request.json().catch(() => null)) as {
      runId?: string;
      status?: string;
      sourceCursor?: unknown;
      safeErrorCode?: string;
    } | null;
    const runId = String(body?.runId || '');
    const status = String(body?.status || '');
    if (!/^[0-9a-f-]{36}$/i.test(runId) || !['running', 'completed', 'failed', 'cancelled'].includes(status)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    let sourceCursor: Record<string, CursorFolder> | undefined;
    try {
      if (body?.sourceCursor !== undefined) sourceCursor = safeCursor(body.sourceCursor);
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const terminal = ['completed', 'cancelled'].includes(status);
    const [updated] = await db
      .update(mailMigrationRuns)
      .set({
        status,
        ...(sourceCursor ? { sourceCursor } : {}),
        ...(terminal ? { encryptedCredential: null, completedAt: new Date() } : {}),
        safeErrorCode:
          status === 'failed' && /^[a-z0-9_]{1,64}$/.test(String(body?.safeErrorCode || ''))
            ? String(body?.safeErrorCode)
            : null,
        updatedAt: new Date(),
      })
      .where(and(eq(mailMigrationRuns.id, runId), inArray(mailMigrationRuns.status, ['queued', 'running'])))
      .returning({ id: mailMigrationRuns.id });
    if (!updated) return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
