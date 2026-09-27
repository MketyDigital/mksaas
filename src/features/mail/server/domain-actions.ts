'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailWorkspaces } from '@/shared/db/schema';

import { enableCloudflareEmailRouting, findCloudflareZone, getCloudflareEmailRouting } from './cloudflare';
import { requireMailWorkspaceAccess } from './workspace';

function normalizeDomain(value:string){
  return value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\.$/,'');
}

export async function addMailDomain(tenantSlug:string,formData:FormData){
  const {actor,tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(!workspace) redirect(`/t/${tenantSlug}/mail`);

  const domain=normalizeDomain(String(formData.get('domain')||''));
  if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)){
    redirect(`/t/${tenantSlug}/mail/domains?error=domain`);
  }

  const duplicate=await db.query.mailDomains.findFirst({where:eq(mailDomains.domain,domain)});
  if(duplicate&&duplicate.tenantId!==tenant.id) redirect(`/t/${tenantSlug}/mail/domains?error=claimed`);
  if(duplicate) redirect(`/t/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}`);

  let zoneId:string|null=null;
  let routingEnabled=false;
  try{
    const zone=await findCloudflareZone(domain);
    if(zone){
      zoneId=zone.id;
      await enableCloudflareEmailRouting(zone.id,domain);
      const routing=await getCloudflareEmailRouting(zone.id);
      routingEnabled=Boolean(routing?.enabled);
    }
  }catch{
    // A customer domain outside Mkety's Cloudflare account remains in guided setup.
  }

  const [created]=await db.insert(mailDomains).values({
    tenantId:tenant.id,
    workspaceId:workspace.id,
    domain,
    status:routingEnabled?'routing_ready':'pending',
    cloudflareZoneId:zoneId,
    routingEnabled,
    mxStatus:routingEnabled?'verified':'pending',
    spfStatus:routingEnabled?'verified':'pending',
  }).returning();

  if(routingEnabled&&created){
    await db.update(mailWorkspaces).set({defaultDomainId:created.id,onboardingStep:'mailbox',updatedAt:new Date()}).where(eq(mailWorkspaces.id,workspace.id));
  }
  revalidatePath(`/t/${tenantSlug}/mail`);
  redirect(`/t/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}`);
}
