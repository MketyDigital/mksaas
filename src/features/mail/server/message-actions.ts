'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailMailboxes, mailMailboxMembers, mailMessages, mailSuppressions } from '@/shared/db/schema';

import { pushMailQueueBatch } from './cloudflare';
import { fetchMailText } from './content';
import { getMailSendCapacity } from './sending-policy';
import { requireMailWorkspaceAccess } from './workspace';

function validEmail(value:string){
  const normalized=value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)?normalized:'';
}

async function authorizeMailbox(tenantSlug:string,mailboxId:string){
  const access=await requireMailWorkspaceAccess(tenantSlug);
  const mailbox=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.id,mailboxId),eq(mailMailboxes.tenantId,access.tenant.id),eq(mailMailboxes.status,'active')),
  });
  if(!mailbox) return {...access,mailbox:null,domain:null};
  if(!['admin','manager'].includes(String(access.membership.role))){
    const membership=await db.query.mailMailboxMembers.findFirst({
      where:and(eq(mailMailboxMembers.mailboxId,mailbox.id),eq(mailMailboxMembers.userId,access.actor.userId)),
    });
    if(!membership) return {...access,mailbox:null,domain:null};
  }
  const domain=await db.query.mailDomains.findFirst({
    where:and(eq(mailDomains.id,mailbox.domainId),eq(mailDomains.tenantId,access.tenant.id)),
  });
  return {...access,mailbox,domain};
}

async function suppressed(tenantId:string,email:string){
  const row=await db.query.mailSuppressions.findFirst({
    where:and(eq(mailSuppressions.tenantId,tenantId),eq(mailSuppressions.email,email)),
  });
  return Boolean(row&&(!row.expiresAt||row.expiresAt.getTime()>Date.now()));
}

export async function composeMail(tenantSlug:string,formData:FormData){
  const mailboxId=String(formData.get('mailboxId')||'');
  const to=validEmail(String(formData.get('to')||''));
  const cc=validEmail(String(formData.get('cc')||''));
  const bcc=validEmail(String(formData.get('bcc')||''));
  const subject=String(formData.get('subject')||'').trim().slice(0,500);
  const text=String(formData.get('message')||'').trim().slice(0,200_000);
  const mode=String(formData.get('mode')||'send');
  const auth=await authorizeMailbox(tenantSlug,mailboxId);
  if(!auth.mailbox||!auth.domain) redirect(`/app/${tenantSlug}/mail/inbox?error=mailbox`);

  if(mode==='draft'){
    const [draft]=await db.insert(mailMessages).values({
      tenantId:auth.tenant.id,
      mailboxId:auth.mailbox.id,
      direction:'outbound',
      fromAddress:`${auth.mailbox.localPart}@${auth.domain.domain}`,
      toJson:to?[to]:[],
      ccJson:cc?[cc]:[],
      bccJson:bcc?[bcc]:[],
      subject:subject||null,
      preview:text.slice(0,240)||null,
      status:'draft',
      folder:'drafts',
    }).returning();
    revalidatePath(`/app/${tenantSlug}/mail/inbox`);
    redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${auth.mailbox.id}&saved=${draft.id}`);
  }

  if(!to||!subject||!text) redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${mailboxId}&error=details`);
  if(await suppressed(auth.tenant.id,to)) redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${mailboxId}&error=suppressed`);
  if(!auth.domain.sendingEnabled) redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${mailboxId}&error=domain`);
  const capacity=await getMailSendCapacity(auth.tenant.id,auth.domain.id,1);
  if(!capacity.allowed) redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${mailboxId}&error=limit`);

  const from=`${auth.mailbox.localPart}@${auth.domain.domain}`;
  const [message]=await db.insert(mailMessages).values({
    tenantId:auth.tenant.id,
    mailboxId:auth.mailbox.id,
    direction:'outbound',
    fromAddress:from,
    toJson:[to],
    ccJson:cc?[cc]:[],
    bccJson:bcc?[bcc]:[],
    subject,
    preview:text.slice(0,240),
    status:'queued',
    folder:'sent',
  }).returning();

  try{
    await pushMailQueueBatch([{
      kind:'inbox',
      tenantId:auth.tenant.id,
      messageId:message.id,
      mailboxId:auth.mailbox.id,
      from:{email:from,name:auth.mailbox.displayName||undefined},
      to:{email:to},
      ...(cc?{cc:[{email:cc}]}:{}),
      ...(bcc?{bcc:[{email:bcc}]}:{}),
      subject,
      text,
    }]);
  }catch{
    await db.update(mailMessages).set({status:'failed'}).where(and(eq(mailMessages.id,message.id),eq(mailMessages.tenantId,auth.tenant.id)));
    redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${mailboxId}&error=queue`);
  }

  revalidatePath(`/app/${tenantSlug}/mail/inbox`);
  redirect(`/app/${tenantSlug}/mail/inbox?mailbox=${mailboxId}&sent=1`);
}

export async function replyToMail(tenantSlug:string,formData:FormData){
  const messageId=String(formData.get('messageId')||'');
  const text=String(formData.get('message')||'').trim().slice(0,200_000);
  const original=await db.query.mailMessages.findFirst({where:eq(mailMessages.id,messageId)});
  if(!original||!text) return;
  const auth=await authorizeMailbox(tenantSlug,original.mailboxId);
  if(!auth.mailbox||!auth.domain||original.tenantId!==auth.tenant.id||!auth.domain.sendingEnabled) return;
  const to=validEmail(original.fromAddress);
  if(!to||await suppressed(auth.tenant.id,to)) return;
  const capacity=await getMailSendCapacity(auth.tenant.id,auth.domain.id,1);
  if(!capacity.allowed) return;

  const from=`${auth.mailbox.localPart}@${auth.domain.domain}`;
  const subject=/^re:/i.test(original.subject||'')?String(original.subject):`Re: ${original.subject||''}`;
  const [reply]=await db.insert(mailMessages).values({
    tenantId:auth.tenant.id,
    mailboxId:auth.mailbox.id,
    threadId:original.threadId,
    direction:'outbound',
    fromAddress:from,
    toJson:[to],
    subject,
    preview:text.slice(0,240),
    status:'queued',
    folder:'sent',
  }).returning();

  await pushMailQueueBatch([{
    kind:'inbox',
    tenantId:auth.tenant.id,
    messageId:reply.id,
    mailboxId:auth.mailbox.id,
    from:{email:from,name:auth.mailbox.displayName||undefined},
    to:{email:to},
    subject,
    text,
    ...(original.internetMessageId?{headers:{'In-Reply-To':original.internetMessageId,'References':original.internetMessageId}}:{}),
  }]);
  revalidatePath(`/app/${tenantSlug}/mail/inbox`);
}

export async function forwardMail(tenantSlug:string,formData:FormData){
  const messageId=String(formData.get('messageId')||'');
  const to=validEmail(String(formData.get('to')||''));
  const note=String(formData.get('message')||'').trim().slice(0,100_000);
  const original=await db.query.mailMessages.findFirst({where:eq(mailMessages.id,messageId)});
  if(!original||!to) return;
  const auth=await authorizeMailbox(tenantSlug,original.mailboxId);
  if(!auth.mailbox||!auth.domain||original.tenantId!==auth.tenant.id||!auth.domain.sendingEnabled) return;
  if(await suppressed(auth.tenant.id,to)) return;
  const capacity=await getMailSendCapacity(auth.tenant.id,auth.domain.id,1);
  if(!capacity.allowed) return;

  const originalBody=await fetchMailText(original.textR2Key);
  const quoted=[
    note,
    '',
    '---------- Forwarded message ----------',
    `From: ${original.fromAddress}`,
    `Subject: ${original.subject||'(no subject)'}`,
    '',
    originalBody||original.preview||'',
  ].join('\n').trim().slice(0,200_000);

  const from=`${auth.mailbox.localPart}@${auth.domain.domain}`;
  const subject=/^fwd:/i.test(original.subject||'')?String(original.subject):`Fwd: ${original.subject||''}`;
  const [forwarded]=await db.insert(mailMessages).values({
    tenantId:auth.tenant.id,
    mailboxId:auth.mailbox.id,
    direction:'outbound',
    fromAddress:from,
    toJson:[to],
    subject,
    preview:quoted.slice(0,240),
    status:'queued',
    folder:'sent',
  }).returning();

  await pushMailQueueBatch([{
    kind:'inbox',
    tenantId:auth.tenant.id,
    messageId:forwarded.id,
    mailboxId:auth.mailbox.id,
    from:{email:from,name:auth.mailbox.displayName||undefined},
    to:{email:to},
    subject,
    text:quoted,
  }]);
  revalidatePath(`/app/${tenantSlug}/mail/inbox`);
}

export async function moveMailMessage(tenantSlug:string,formData:FormData){
  const messageId=String(formData.get('messageId')||'');
  const folder=String(formData.get('folder')||'');
  if(!['inbox','archive','trash','spam'].includes(folder)) return;
  const message=await db.query.mailMessages.findFirst({where:eq(mailMessages.id,messageId)});
  if(!message) return;
  const auth=await authorizeMailbox(tenantSlug,message.mailboxId);
  if(!auth.mailbox||message.tenantId!==auth.tenant.id) return;
  await db.update(mailMessages).set({folder}).where(and(eq(mailMessages.id,message.id),eq(mailMessages.tenantId,auth.tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/inbox`);
}

export async function toggleMailStar(tenantSlug:string,formData:FormData){
  const messageId=String(formData.get('messageId')||'');
  const message=await db.query.mailMessages.findFirst({where:eq(mailMessages.id,messageId)});
  if(!message) return;
  const auth=await authorizeMailbox(tenantSlug,message.mailboxId);
  if(!auth.mailbox||message.tenantId!==auth.tenant.id) return;
  await db.update(mailMessages).set({isStarred:!message.isStarred}).where(and(eq(mailMessages.id,message.id),eq(mailMessages.tenantId,auth.tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/inbox`);
}
