import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { fetchMailContent, fetchMailText } from '@/features/mail/server/content';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxMembers, mailMessages, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';

function sanitizeFilename(value:string){
  return value.replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,120)||'message';
}

export async function GET(request:Request,context:{params:Promise<{messageId:string}>}){
  const {messageId}=await context.params;
  const session=await auth(request);
  if(!session?.user?.id) return NextResponse.json({ok:false},{status:401});

  const message=await db.query.mailMessages.findFirst({where:eq(mailMessages.id,messageId)});
  if(!message) return NextResponse.json({ok:false},{status:404});
  const membership=await db.query.tenantMemberships.findFirst({
    where:and(
      eq(tenantMemberships.userId,session.user.id),
      eq(tenantMemberships.tenantId,message.tenantId),
    ),
  });
  if(!membership) return NextResponse.json({ok:false},{status:403});
  if(!['admin','manager'].includes(String(membership.role))){
    const mailboxMembership=await db.query.mailMailboxMembers.findFirst({
      where:and(
        eq(mailMailboxMembers.mailboxId,message.mailboxId),
        eq(mailMailboxMembers.userId,session.user.id),
      ),
    });
    if(!mailboxMembership) return NextResponse.json({ok:false},{status:403});
  }

  let bytes:Uint8Array|null=null;
  if(message.rawR2Key){
    const raw=await fetchMailContent(message.rawR2Key);
    bytes=raw?.bytes??null;
  }
  if(!bytes){
    const body=await fetchMailText(message.textR2Key)||message.preview||'';
    const date=(message.receivedAt??message.sentAt??message.createdAt).toUTCString();
    const lines=[
      `From: ${message.fromAddress}`,
      `To: ${message.toJson.join(', ')}`,
      ...(message.ccJson.length?[`Cc: ${message.ccJson.join(', ')}`]:[]),
      `Subject: ${message.subject??''}`,
      `Date: ${date}`,
      ...(message.internetMessageId?[`Message-ID: ${message.internetMessageId}`]:[]),
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      body,
    ];
    bytes=new TextEncoder().encode(lines.join('\r\n'));
  }

  const responseBody=new Uint8Array(bytes.byteLength);
  responseBody.set(bytes);
  return new Response(responseBody,{
    headers:{
      'content-type':'message/rfc822',
      'content-disposition':`attachment; filename="${sanitizeFilename(message.subject||message.id)}.eml"`,
      'cache-control':'private, no-store',
    },
  });
}
