'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { importMailArchive, MailArchiveImportError } from './archive-import-service';

export async function importMailEmlFiles(tenantSlug: string, formData: FormData) {
  try {
    const result = await importMailArchive(tenantSlug, formData);
    revalidatePath(`/app/${tenantSlug}/mail/inbox`);
    redirect(`/app/${tenantSlug}/mail/migration?imported=${result.imported}&run=${result.runId}`);
  } catch (error) {
    if (error instanceof MailArchiveImportError) {
      redirect(`/app/${tenantSlug}/mail/migration?error=${error.code}`);
    }
    throw error;
  }
}
