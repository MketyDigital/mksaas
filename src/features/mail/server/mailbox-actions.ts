'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxMembers, mailMailboxes, mailWorkspaces } from '@/shared/db/schema';

import { requireMailWorkspaceAccess } from './workspace';

function cleanLocalPart(value:string){
  return value.trim().toLowerCase().replace(/[^a-z0-9._+-]/g,'').slice(0,128);
}

export async function createMailbox(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(!workspace) redirect(`/t/${tenantSlug}/mail`);

  const domainId=String(formData.get('domainId')||'');
  const localPart=cleanLocalPart(String(formData.get('localPart')||''));
  const displayName=String(formData.get('displayName')||'').trim().slice(0,255);
  const type=String(formData.get('type')||'personal')==='shared'?'shared':'personal';
  const forwardingAddress=String(formData.get('forwardingAddress')||'').trim().toLowerCase();

  if(!localPart||!/^[a-z0-9](?:[a-z0-9._+-]{0,126}[a-z0-9])?$/.test(localPart)){
    redirect(`/t/${tenantSlug}/mail/mailboxes?error=address`);
  }
  if(forwardingAddress&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardingAddress)){
    redirect(`/t/${tenantSlug}/mail/mailboxes?error=forward`);
  }

  const domain=await db.query.mailDomains.findFirst({
    where:and(eq(mailDomains.id,domainId),eq(mailDomains.tenantId,tenant.id)),
  });
  if(!domain) redirect(`/t/${tenantSlug}/mail/mailboxes?error=domain`);

  const [mailbox]=await db.insert(mailMailboxes).values({
    tenantId:tenant.id,
    workspaceId:workspace.id,
    domainId:domain.id,
    localPart,
    displayName:displayName||null,
    type,
    forwardingAddress:forwardingAddress||null,
    createdByUserId:actor.userId,
  }).onConflictDoNothing({target:[mailMailboxes.domainId,mailMailboxes.localPart]}).returning();

  if(mailbox){
    await db.insert(mailMailboxMembers).values({
      tenantId:tenant.id,
      mailboxId:mailbox.id,
      userId:actor.userId,
      role:'owner',
    }).onConflictDoNothing();
    await db.update(mailWorkspaces).set({onboardingStep:'ready',updatedAt:new Date()}).where(eq(mailWorkspaces.id,workspace.id));
  }

  revalidatePath(`/t/${tenantSlug}/mail`);
  revalidatePath(`/t/${tenantSlug}/mail/mailboxes`);
  redirect(`/t/${tenantSlug}/mail/mailboxes`);
}
