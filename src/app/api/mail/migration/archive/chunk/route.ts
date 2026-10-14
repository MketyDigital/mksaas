import { NextResponse } from 'next/server';

import {
  archiveUploadChunkKey,
  MAX_ARCHIVE_CHUNK_BYTES,
  MAX_ARCHIVE_UPLOAD_CHUNKS,
  requireMailArchiveImportAccess,
} from '@/features/mail/server/archive-import-service';
import { storeMailContent } from '@/features/mail/server/content';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get('tenant')?.trim() || '';
  if (!/^[a-z0-9-]{2,63}$/.test(tenantSlug)) return NextResponse.json({ error: 'tenant' }, { status: 400 });
  if (request.headers.get('origin') !== url.origin) return NextResponse.json({ error: 'origin' }, { status: 403 });

  const uploadId = url.searchParams.get('uploadId') || '';
  const fileIndex = Number(url.searchParams.get('fileIndex'));
  const chunkIndex = Number(url.searchParams.get('chunkIndex'));
  if (
    !/^[0-9a-f-]{36}$/i.test(uploadId) ||
    !Number.isSafeInteger(fileIndex) ||
    fileIndex < 0 ||
    fileIndex >= 20 ||
    !Number.isSafeInteger(chunkIndex) ||
    chunkIndex < 0 ||
    chunkIndex >= MAX_ARCHIVE_UPLOAD_CHUNKS
  ) {
    return NextResponse.json({ error: 'upload' }, { status: 400 });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_ARCHIVE_CHUNK_BYTES) return NextResponse.json({ error: 'size' }, { status: 413 });

  const access = await requireMailArchiveImportAccess(tenantSlug);
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: 'size' }, { status: 400 });
  const pieces: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ARCHIVE_CHUNK_BYTES) {
      await reader.cancel();
      return NextResponse.json({ error: 'size' }, { status: 413 });
    }
    pieces.push(value);
  }
  if (!size) return NextResponse.json({ error: 'size' }, { status: 400 });
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const piece of pieces) {
    bytes.set(piece, offset);
    offset += piece.byteLength;
  }
  const key = archiveUploadChunkKey(access.tenant.id, uploadId, fileIndex, chunkIndex);
  await storeMailContent(key, bytes, 'application/octet-stream');
  return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
