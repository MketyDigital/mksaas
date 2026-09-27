import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { fetchAttachmentManifest, fetchMailContent } from '@/features/mail/server/content';
import { db } from '@/shared/db/cloudflare';
import { mailMailboxes, mailMailboxMembers, mailMessages, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

function dispositionFilename(value:string){
  return value.replace(/[\r\n"]/g,'_').slice(0,180)||'attachment';
}

export async function GET(_request:Request,{params}:{params:Promise<{messageId:string;index:string}>}){
  const url=new URL(_request.url);
  const tenantSlug=String(url.searchParams.get('tenant')||'');
  const session=await auth(_request);
  if(!session?.user?.id||!tenantSlug) return NextResponse.json({ok:false},{status:401});

  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) return NextResponse.json({ok:false},{status:404});
  const membership=await db.query.tenantMemberships.findFirst({
    where:and(eq(tenantMemberships.tenantId,tenant.id),eq(tenantMemberships.userId,session.user.id)),
  });
  if(!membership) return NextResponse.json({ok:false},{status:403});

  const {messageId,index}=await params;
  const message=await db.query.mailMessages.findFirst({
    where:and(eq(mailMessages.id,messageId),eq(mailMessages.tenantId,tenant.id)),
  });
  if(!message) return NextResponse.json({ok:false},{status:404});
  const mailbox=await db.query.mailMailboxes.findFirst({
    where:and(eq(mailMailboxes.id,message.mailboxId),eq(mailMailboxes.tenantId,tenant.id)),
  });
  if(!mailbox) return NextResponse.json({ok:false},{status:404});

  if(!['admin','manager'].includes(String(membership.role))){
    const access=await db.query.mailMailboxMembers.findFirst({
      where:and(eq(mailMailboxMembers.mailboxId,mailbox.id),eq(mailMailboxMembers.userId,session.user.id)),
    });
    if(!access) return NextResponse.json({ok:false},{status:403});
  }

  const attachments=await fetchAttachmentManifest(message.rawR2Key);
  const attachment=attachments[Number.parseInt(index,10)];
  if(!attachment) return NextResponse.json({ok:false},{status:404});
  const object=await fetchMailContent(attachment.r2Key);
  if(!object) return NextResponse.json({ok:false},{status:404});

  return new Response(object.bytes,{
    headers:{
      'content-type':attachment.contentType||object.contentType,
      'content-disposition':'attachment; filename="'+dispositionFilename(attachment.filename)+'"',
      'cache-control':'private, no-store',
      'x-content-type-options':'nosniff',
    },
  });
}
