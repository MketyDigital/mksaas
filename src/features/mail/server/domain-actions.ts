'use server';

import { count, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailWorkspaces } from '@/shared/db/schema';

import {
  enableCloudflareEmailRouting,
  enableCloudflareEmailSending,
  ensureCloudflareEmailEventSubscription,
  findCloudflareZone,
  getCloudflareEmailRouting,
  getCloudflareEmailSending,
  getCloudflareEmailSendingDns,
  getPublicCloudflareSendingDns,
} from './cloudflare';
import { areCloudflareEmailAuthRecordsPublished, getMailDomainProvisioningPolicy } from './domain-provisioning-policy';
import { requireMailWorkspaceAccess } from './workspace';
import { resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';

function normalizeDomain(value:string){
  return value.trim().toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/\.$/,'');
}

export async function addMailDomain(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(!workspace) redirect(`/app/${tenantSlug}/mail`);

  const planKey=await resolveTenantMailPlanKey(tenant.id,workspace.planKey,tenant.slug);
  const limits=await resolveTenantMailPlanLimits(tenant.id,planKey);
  if(limits){
    const [countRow]=await db.select({value:count()}).from(mailDomains).where(eq(mailDomains.tenantId,tenant.id));
    if(Number(countRow?.value??0)>=limits.domains) redirect(`/app/${tenantSlug}/mail/domains?error=plan-limit`);
  }

  const domain=normalizeDomain(String(formData.get('domain')||''));
  if(!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)){
    redirect(`/app/${tenantSlug}/mail/domains?error=domain`);
  }

  const provisioning=getMailDomainProvisioningPolicy(domain);
  if(!provisioning.allowed) redirect(`/app/${tenantSlug}/mail/domains?error=reserved-domain`);

  const duplicate=await db.query.mailDomains.findFirst({where:eq(mailDomains.domain,domain)});
  if(duplicate&&duplicate.tenantId!==tenant.id) redirect(`/app/${tenantSlug}/mail/domains?error=claimed`);
  if(duplicate) redirect(`/app/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}`);

  let zoneId:string|null=null;
  let routingEnabled=false;
  let sendingEnabled=false;
  let sendingAuthVerified=false;
  try{
    const zone=await findCloudflareZone(domain);
    if(zone){
      zoneId=zone.id;
      if(provisioning.configureRouting){
        await enableCloudflareEmailRouting(zone.id,domain);
        const routing=await getCloudflareEmailRouting(zone.id);
        routingEnabled=Boolean(routing?.enabled);
      }
      if(provisioning.configureSending){
        const configuredSending=await getCloudflareEmailSending(zone.id,domain);
        const sending=configuredSending||await enableCloudflareEmailSending(zone.id,domain);
        sendingEnabled=Boolean(sending?.enabled);
        if(sendingEnabled&&typeof sending?.tag==='string'){
          const expectedRecords=await getCloudflareEmailSendingDns(zone.id,sending.tag);
          const publicRecords=await getPublicCloudflareSendingDns(expectedRecords);
          sendingAuthVerified=areCloudflareEmailAuthRecordsPublished(domain,sendingEnabled,expectedRecords,publicRecords);
        }
        if(sendingEnabled) await ensureCloudflareEmailEventSubscription(zone.id,domain);
      }
    }
  }catch{
    // A customer domain outside Mkety's Cloudflare account remains in guided setup.
  }

  const [created]=await db.insert(mailDomains).values({
    tenantId:tenant.id,
    workspaceId:workspace.id,
    domain,
    status:routingEnabled&&sendingAuthVerified?'ready':routingEnabled?'routing_ready':sendingAuthVerified?'sending_ready':'pending',
    cloudflareZoneId:zoneId,
    routingEnabled,
    sendingEnabled,
    mxStatus:routingEnabled?'verified':'pending',
    spfStatus:sendingAuthVerified?'verified':'pending',
    dkimStatus:sendingAuthVerified?'verified':'pending',
    dmarcStatus:sendingAuthVerified?'verified':'pending',
  }).returning();

  if(routingEnabled&&created){
    await db.update(mailWorkspaces).set({defaultDomainId:created.id,onboardingStep:'mailbox',updatedAt:new Date()}).where(eq(mailWorkspaces.id,workspace.id));
  }
  revalidatePath(`/app/${tenantSlug}/mail`);
  redirect(`/app/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}`);
}
