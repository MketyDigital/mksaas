'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMessages } from '@/shared/db/schema';

import { storeMailContent } from './content';
import { requireMailWorkspaceAccess } from './workspace';

function unfoldHeaders(text:string){
  return text.replace(/\r?\n[ \t]+/g,' ');
}

function parseHeaders(raw:string){
  const normalized=raw.replace(/\r\n/g,'\n');
  const split=normalized.indexOf('\n\n');
  const headerText=unfoldHeaders(split>=0?normalized.slice(0,split):normalized);
  const body=split>=0?normalized.slice(split+2):'';
  const headers=new Map<string,string>();
  for(const line of headerText.split('\n')){
    const index=line.indexOf(':');
    if(index<=0) continue;
    const key=line.slice(0,index).trim().toLowerCase();
    const value=line.slice(index+1).trim();
    if(key&&!headers.has(key)) headers.set(key,value);
  }
  return {headers,body};
}

function firstAddress(value:string|undefined){
  if(!value) return '';
  const angle=value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if(angle?.[1]) return angle[1].trim().toLowerCase();
  const plain=value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plain?.[0]?.trim().toLowerCase()??'';
}

function addressList(value:string|undefined){
  if(!value) return [] as string[];
  return value.split(',').map((item)=>firstAddress(item)).filter(Boolean).slice(0,100);
}

export async function importMailEmlFiles(tenantSlug:string,formData:FormData){
  const access=await requireMailWorkspaceAccess(tenantSlug);
  const mailboxId=String(formData.get('mailboxId')||'');
  const mailbox=await db.query.mailMailboxes.findFirst({
    where:and(
      eq(mailMailboxes.id,mailboxId),
      eq(mailMailboxes.tenantId,access.tenant.id),
      eq(mailMailboxes.status,'active'),
    ),
  });
  if(!mailbox) redirect(`/t/${tenantSlug}/mail/migration?error=mailbox`);

  const files=formData.getAll('files').filter((value):value is File=>value instanceof File&&value.size>0);
  if(!files.length||files.length>20) redirect(`/t/${tenantSlug}/mail/migration?error=files`);
  if(files.some((file)=>!file.name.toLowerCase().endsWith('.eml')&&file.type!=='message/rfc822')){
    redirect(`/t/${tenantSlug}/mail/migration?error=type`);
  }
  const total=files.reduce((sum,file)=>sum+file.size,0);
  if(total>25_000_000||files.some((file)=>file.size>10_000_000)){
    redirect(`/t/${tenantSlug}/mail/migration?error=size`);
  }

  let imported=0;
  for(const file of files){
    const bytes=new Uint8Array(await file.arrayBuffer());
    const raw=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
    const {headers,body}=parseHeaders(raw);
    const from=firstAddress(headers.get('from'));
    if(!from) continue;

    const messageId=crypto.randomUUID();
    const rawR2Key=`mail/${access.tenant.id}/${mailbox.id}/migration/${messageId}/raw.eml`;
    await storeMailContent(rawR2Key,bytes,'message/rfc822');

    const dateValue=headers.get('date');
    const parsedDate=dateValue?new Date(dateValue):new Date();
    const occurredAt=Number.isFinite(parsedDate.getTime())?parsedDate:new Date();
    await db.insert(mailMessages).values({
      id:messageId,
      tenantId:access.tenant.id,
      mailboxId:mailbox.id,
      direction:'inbound',
      providerMessageId:null,
      internetMessageId:headers.get('message-id')?.slice(0,1000)||null,
      fromAddress:from,
      toJson:addressList(headers.get('to')),
      ccJson:addressList(headers.get('cc')),
      bccJson:[],
      subject:headers.get('subject')?.slice(0,2000)||null,
      preview:body.replace(/\s+/g,' ').trim().slice(0,240)||null,
      rawR2Key,
      status:'delivered',
      folder:'inbox',
      isRead:false,
      receivedAt:occurredAt,
      createdAt:occurredAt,
    });
    imported+=1;
  }

  revalidatePath(`/t/${tenantSlug}/mail/inbox`);
  redirect(`/t/${tenantSlug}/mail/migration?imported=${imported}`);
}
