'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailWorkspaces } from '@/shared/db/schema';

import { enableCloudflareEmailRouting, enableCloudflareEmailSending, findCloudflareZone, getCloudflareEmailRouting } from './cloudflare';
import { requireMailWorkspaceAccess } from './workspace';

function normalizeDomain(value:string){
  return value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\.$/,'');
}

export async function addMailDomain(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
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
  let sendingEnabled=false;
  try{
    const zone=await findCloudflareZone(domain);
    if(zone){
      zoneId=zone.id;
      await enableCloudflareEmailRouting(zone.id,domain);
      const routing=await getCloudflareEmailRouting(zone.id);
      routingEnabled=Boolean(routing?.enabled);
      const sending=await enableCloudflareEmailSending(zone.id,domain);
      sendingEnabled=Boolean(sending?.enabled);
    }
  }catch{
    // A customer domain outside Mkety's Cloudflare account remains in guided setup.
  }

  const [created]=await db.insert(mailDomains).values({
    tenantId:tenant.id,
    workspaceId:workspace.id,
    domain,
    status:routingEnabled&&sendingEnabled?'ready':routingEnabled?'routing_ready':'pending',
    cloudflareZoneId:zoneId,
    routingEnabled,
    sendingEnabled,
    mxStatus:routingEnabled?'verified':'pending',
    spfStatus:routingEnabled||sendingEnabled?'verified':'pending',
    dkimStatus:sendingEnabled?'verified':'pending',
    dmarcStatus:sendingEnabled?'verified':'pending',
  }).returning();

  if(routingEnabled&&created){
    await db.update(mailWorkspaces).set({defaultDomainId:created.id,onboardingStep:'mailbox',updatedAt:new Date()}).where(eq(mailWorkspaces.id,workspace.id));
  }
  revalidatePath(`/t/${tenantSlug}/mail`);
  redirect(`/t/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}`);
}
