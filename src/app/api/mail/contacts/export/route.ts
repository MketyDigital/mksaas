import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/shared/db/cloudflare';
import { mailContacts, tenantMemberships } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { getTenantBySlug } from '@/shared/lib/tenant';

function csv(value:unknown){
  const text=String(value??'');
  return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
}

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

  const contacts=await db.query.mailContacts.findMany({
    where:eq(mailContacts.tenantId,tenant.id),
    orderBy:[asc(mailContacts.email)],
    limit:10000,
  });
  const lines=['Email,Name,Company,Tags,Status'];
  for(const contact of contacts){
    lines.push([
      csv(contact.email),
      csv(contact.name),
      csv(contact.company),
      csv(contact.tags.join(';')),
      csv(contact.status),
    ].join(','));
  }
  return new Response(lines.join('\r\n'),{
    headers:{
      'content-type':'text/csv; charset=utf-8',
      'content-disposition':'attachment; filename="mkety-mail-contacts.csv"',
      'cache-control':'private, no-store',
    },
  });
}
