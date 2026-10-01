'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailTemplates } from '@/shared/db/schema';

import { requireMailWorkspaceAccess } from './workspace';

export async function saveMailTemplate(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const name=String(formData.get('name')||'').trim().slice(0,255);
  const type=String(formData.get('type')||'transactional');
  const subject=String(formData.get('subject')||'').trim().slice(0,500);
  const text=String(formData.get('text')||'').slice(0,200_000);
  if(!name||!text) redirect(`/app/${tenantSlug}/mail/templates?error=details`);
  await db.insert(mailTemplates).values({
    tenantId:tenant.id,name,type:type==='customer_update'?'customer_update':type==='reply'?'reply':'transactional',
    subject:subject||null,text,createdByUserId:actor.userId,
  });
  revalidatePath(`/app/${tenantSlug}/mail/templates`);
  redirect(`/app/${tenantSlug}/mail/templates?saved=1`);
}

export async function deleteMailTemplate(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const id=String(formData.get('id')||'');
  await db.delete(mailTemplates).where(and(eq(mailTemplates.id,id),eq(mailTemplates.tenantId,tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/templates`);
}
