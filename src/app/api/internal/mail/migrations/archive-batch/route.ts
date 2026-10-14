import { NextResponse } from 'next/server';

import { processMailArchiveBatch } from '@/features/mail/server/archive-import-service';
import { getMailInternalSecret } from '@/features/mail/server/runtime-config';
import { withRequestDatabase } from '@/shared/db/request';

export async function POST(request: Request) {
  const secret = getMailInternalSecret();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { runId?: string } | null;
  const runId = String(body?.runId || '');
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return NextResponse.json({ ok: false }, { status: 400 });
  return withRequestDatabase(async () => {
    const result = await processMailArchiveBatch(runId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  });
}
