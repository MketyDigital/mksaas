import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/shared/db/cloudflare';
import {
  mailContacts,
  mailDomains,
  mailMailboxes,
  mailTemplates,
  mailWorkspaces,
  tenantMemberships,
} from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

export async function GET(request:Request){
  const url=new URL(request.url);
  const tenantSlug=String(url.searchParams.get('tenant')||'');
  const session=await auth(request);
  if(!session?.user?.id||!tenantSlug) return NextResponse.json({ok:false},{status:401});
  const tenant=await getTenantBySlug(tenantSlug);
  if(!tenant) return NextResponse.json({ok:false},{status:404});
  const membership=await db.query.tenantMemberships.findFirst({
    where:and(
      eq(tenantMemberships.userId,session.user.id),
      eq(tenantMemberships.tenantId,tenant.id),
    ),
  });
  if(!membership) return NextResponse.json({ok:false},{status:403});
  if(!['admin','manager'].includes(String(membership.role))) return NextResponse.json({ok:false},{status:403});

  const [workspace,domains,mailboxes,contacts,templates]=await Promise.all([
    db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)}),
    db.select().from(mailDomains).where(eq(mailDomains.tenantId,tenant.id)).orderBy(asc(mailDomains.domain)),
    db.select().from(mailMailboxes).where(eq(mailMailboxes.tenantId,tenant.id)).orderBy(asc(mailMailboxes.localPart)),
    db.select().from(mailContacts).where(eq(mailContacts.tenantId,tenant.id)).orderBy(asc(mailContacts.email)).limit(10000),
    db.select().from(mailTemplates).where(eq(mailTemplates.tenantId,tenant.id)).orderBy(asc(mailTemplates.name)).limit(1000),
  ]);

  const exportObject={
    format:'mkety-mail-portability-v1',
    exportedAt:new Date().toISOString(),
    tenant:{slug:tenant.slug,name:tenant.name},
    workspace:workspace?{
      status:workspace.status,
      planKey:workspace.planKey,
      onboardingStep:workspace.onboardingStep,
    }:null,
    domains:domains.map((item)=>({
      domain:item.domain,
      status:item.status,
      sendingEnabled:item.sendingEnabled,
      routingEnabled:item.routingEnabled,
    })),
    mailboxes:mailboxes.map((item)=>({
      id:item.id,
      localPart:item.localPart,
      domainId:item.domainId,
      displayName:item.displayName,
      type:item.type,
      status:item.status,
      catchAll:item.catchAll,
      forwardingAddress:item.forwardingAddress,
      signatureHtml:item.signatureHtml,
      signatureText:item.signatureText,
    })),
    contacts:contacts.map((item)=>({
      email:item.email,
      name:item.name,
      company:item.company,
      tags:item.tags,
      customFields:item.customFields,
      status:item.status,
    })),
    templates:templates.map((item)=>({
      name:item.name,
      type:item.type,
      subject:item.subject,
      html:item.html,
      text:item.text,
      variables:item.variables,
    })),
    excluded:[
      'API keys',
      'app passwords',
      'provider credentials',
      'Cloudflare credentials',
      'verified settlement records',
    ],
  };

  return NextResponse.json(exportObject,{
    headers:{
      'content-disposition':`attachment; filename="mkety-mail-${tenant.slug}-workspace.json"`,
      'cache-control':'private, no-store',
    },
  });
}
