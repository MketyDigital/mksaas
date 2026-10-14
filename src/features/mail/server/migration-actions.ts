'use server';

import { redirect } from 'next/navigation';

import { requireMailArchiveImportAccess } from './archive-import-service';

export async function importMailEmlFiles(tenantSlug: string, _formData: FormData) {
  await requireMailArchiveImportAccess(tenantSlug);
  redirect(`/app/${tenantSlug}/mail/migration?error=upload-version`);
}
