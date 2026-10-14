import { NextResponse } from 'next/server';

import {
  completeMailArchiveUpload,
  MailArchiveImportError,
  requireMailArchiveImportAccess,
  SAFE_ARCHIVE_ERRORS,
} from '@/features/mail/server/archive-import-service';

const safeCodes = new Set<string>(SAFE_ARCHIVE_ERRORS);

export async function POST(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get('tenant')?.trim() || '';
  if (!/^[a-z0-9-]{2,63}$/.test(tenantSlug)) return NextResponse.json({ error: 'files' }, { status: 400 });
  if (request.headers.get('origin') !== url.origin) return NextResponse.json({ error: 'files' }, { status: 403 });
  const access = await requireMailArchiveImportAccess(tenantSlug);
  const body = (await request.json().catch(() => null)) as {
    mailboxId?: string;
    uploadId?: string;
    files?: Array<{ name?: string; size?: number; chunks?: number }>;
  } | null;
  try {
    const result = await completeMailArchiveUpload(
      tenantSlug,
      {
        mailboxId: String(body?.mailboxId || ''),
        uploadId: String(body?.uploadId || ''),
        files: Array.isArray(body?.files)
          ? body.files.map((file) => ({
              name: String(file.name || ''),
              size: Number(file.size),
              chunks: Number(file.chunks),
            }))
          : [],
      },
      access,
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof MailArchiveImportError && safeCodes.has(error.code)) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    if (error instanceof Error && /^archive_[a-z_]+$/.test(error.message)) {
      return NextResponse.json({ error: error.message.slice('archive_'.length) }, { status: 503 });
    }
    throw error;
  }
}
