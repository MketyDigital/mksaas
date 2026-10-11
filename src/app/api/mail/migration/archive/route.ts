import { revalidatePath } from 'next/cache';

import {
  importMailArchive,
  MailArchiveImportError,
  MAX_ARCHIVE_UPLOAD_BYTES,
  requireMailArchiveImportAccess,
  SAFE_ARCHIVE_ERRORS,
} from '@/features/mail/server/archive-import-service';

const MAX_MULTIPART_OVERHEAD = 256_000;
const SAFE_ERROR_CODES = new Set<string>(SAFE_ARCHIVE_ERRORS);

function redirectToMigration(request: Request, tenantSlug: string, query: string) {
  const destination = new URL(`/app/${encodeURIComponent(tenantSlug)}/mail/migration?${query}`, request.url);
  return Response.redirect(destination, 303);
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const tenantSlug = requestUrl.searchParams.get('tenant')?.trim() || '';
  if (!/^[a-z0-9-]{2,63}$/.test(tenantSlug)) return new Response('Invalid tenant.', { status: 400 });

  const origin = request.headers.get('origin');
  if (origin !== requestUrl.origin) return new Response('Cross-origin upload rejected.', { status: 403 });

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_ARCHIVE_UPLOAD_BYTES + MAX_MULTIPART_OVERHEAD) {
    return redirectToMigration(request, tenantSlug, 'error=size');
  }

  const access = await requireMailArchiveImportAccess(tenantSlug);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectToMigration(request, tenantSlug, 'error=files');
  }

  try {
    const result = await importMailArchive(tenantSlug, formData, access);
    revalidatePath(`/app/${tenantSlug}/mail/inbox`);
    return redirectToMigration(
      request,
      tenantSlug,
      `imported=${result.imported}&run=${encodeURIComponent(result.runId)}`,
    );
  } catch (error) {
    if (error instanceof MailArchiveImportError || (error && typeof error === 'object' && 'code' in error)) {
      const code = String((error as { code?: unknown }).code || '');
      if (SAFE_ERROR_CODES.has(code)) return redirectToMigration(request, tenantSlug, `error=${code}`);
    }
    throw error;
  }
}
