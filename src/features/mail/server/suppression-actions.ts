'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db } from '@/shared/db/cloudflare';
import { mailSuppressions } from '@/shared/db/schema';

import { requireMailWorkspaceAccess } from './workspace';

function validEmail(value:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}

export async function addMailSuppression(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const email=String(formData.get('email')||'').trim().toLowerCase();
  if(!validEmail(email)) return;
  await db.insert(mailSuppressions).values({tenantId:tenant.id,email,reason:'manual',source:'customer'}).onConflictDoNothing({
    target:[mailSuppressions.tenantId,mailSuppressions.email],
  });
  revalidatePath(`/app/${tenantSlug}/mail/analytics`);
}

export async function removeManualMailSuppression(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const id=String(formData.get('id')||'');
  const row=await db.query.mailSuppressions.findFirst({where:and(eq(mailSuppressions.id,id),eq(mailSuppressions.tenantId,tenant.id))});
  if(!row||!['manual','opt_out'].includes(row.reason)) return;
  await db.delete(mailSuppressions).where(and(eq(mailSuppressions.id,id),eq(mailSuppressions.tenantId,tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/analytics`);
}
