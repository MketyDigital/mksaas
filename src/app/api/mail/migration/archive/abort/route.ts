import { NextResponse } from 'next/server';

import {
  archiveUploadChunkKey,
  MAX_ARCHIVE_UPLOAD_CHUNKS,
  requireMailArchiveImportAccess,
} from '@/features/mail/server/archive-import-service';
import { deleteMailContent } from '@/features/mail/server/content';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get('tenant')?.trim() || '';
  if (!/^[a-z0-9-]{2,63}$/.test(tenantSlug) || request.headers.get('origin') !== url.origin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const access = await requireMailArchiveImportAccess(tenantSlug);
  const body = (await request.json().catch(() => null)) as {
    uploadId?: string;
    files?: Array<{ chunks?: number }>;
  } | null;
  const uploadId = String(body?.uploadId || '');
  const files = Array.isArray(body?.files) ? body.files : [];
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || files.length > 20) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const keys = files.flatMap((file, fileIndex) => {
    const chunks = Number(file.chunks);
    if (!Number.isInteger(chunks) || chunks < 0 || chunks > MAX_ARCHIVE_UPLOAD_CHUNKS) return [];
    return Array.from({ length: chunks }, (_, chunkIndex) =>
      archiveUploadChunkKey(access.tenant.id, uploadId, fileIndex, chunkIndex),
    );
  });
  await Promise.allSettled(keys.map((key) => deleteMailContent(key)));
  return NextResponse.json({ ok: true });
}
