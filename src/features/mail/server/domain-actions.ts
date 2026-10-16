'use server';

import { and, count, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailDomains, mailWorkspaces } from '@/shared/db/schema';
import {
  enableCloudflareEmailRouting,
  enableCloudflareEmailSending,
  ensureCloudflareEmailEventSubscription,
  ensureCloudflareEmailSendingDns,
  findCloudflareZone,
  getCloudflareEmailRouting,
  getCloudflareEmailSending,
  getCloudflareEmailSendingDns,
  getPublicCloudflareSendingDns,
} from './cloudflare';
import { resolveTenantMailPlanKey, resolveTenantMailPlanLimits } from './commercial';
import { areCloudflareEmailAuthRecordsPublished, getMailDomainProvisioningPolicy } from './domain-provisioning-policy';
import { provisionMailDomain } from './domain-setup';
import { getFirstPartyMailTenantId } from './runtime-config';
import { requireMailWorkspaceAccess } from './workspace';

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

  const provisioning=getMailDomainProvisioningPolicy(domain,tenant.id===getFirstPartyMailTenantId().trim()&&tenant.slug==='mkety-ops');
  if(!provisioning.allowed) redirect(`/app/${tenantSlug}/mail/domains?error=reserved-domain`);

  const duplicate=await db.query.mailDomains.findFirst({where:eq(mailDomains.domain,domain)});
  if(duplicate&&duplicate.tenantId!==tenant.id) redirect(`/app/${tenantSlug}/mail/domains?error=claimed`);
  const result=await provisionMailDomain(domain,provisioning,cloudflareDomainSetup);
  if(duplicate){
    await saveMailDomainSetup(duplicate.id,tenant.id,workspace.id,result);
    if(result.routingEnabled) await setDefaultMailDomain(workspace.id,duplicate.id);
    revalidatePath(`/app/${tenantSlug}/mail`);
    redirect(`/app/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}&setup=${getSetupResult(result,provisioning)}`);
  }

  const [created]=await db.insert(mailDomains).values({
    tenantId:tenant.id,
    workspaceId:workspace.id,
    domain,
    status:result.routingEnabled&&result.sendingAuthVerified?'ready':result.routingEnabled?'routing_ready':result.sendingAuthVerified?'sending_ready':'pending',
    cloudflareZoneId:result.zoneId,
    routingEnabled:result.routingEnabled,
    sendingEnabled:result.sendingEnabled,
    mxStatus:result.routingEnabled?'verified':'pending',
    spfStatus:result.sendingAuthVerified?'verified':'pending',
    dkimStatus:result.sendingAuthVerified?'verified':'pending',
    dmarcStatus:result.sendingAuthVerified?'verified':'pending',
  }).returning();

  if(result.routingEnabled&&created){
    await setDefaultMailDomain(workspace.id,created.id);
  }
  revalidatePath(`/app/${tenantSlug}/mail`);
  redirect(`/app/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain)}&setup=${getSetupResult(result,provisioning)}`);
}

export async function retryMailDomainSetup(tenantSlug:string,domainId:string){
  console.info('[mail-domain-setup] retry started',{stage:'authorize_workspace'});
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const workspace=await db.query.mailWorkspaces.findFirst({where:eq(mailWorkspaces.tenantId,tenant.id)});
  if(!workspace) redirect(`/app/${tenantSlug}/mail`);
  const domain=await db.query.mailDomains.findFirst({where:and(
    eq(mailDomains.id,domainId),
    eq(mailDomains.tenantId,tenant.id),
    eq(mailDomains.workspaceId,workspace.id),
  )});
  if(!domain) redirect(`/app/${tenantSlug}/mail/domains?error=domain`);
  const policy=getMailDomainProvisioningPolicy(domain.domain,tenant.id===getFirstPartyMailTenantId().trim()&&tenant.slug==='mkety-ops');
  if(!policy.allowed) redirect(`/app/${tenantSlug}/mail/domains?error=reserved-domain`);
  const result=await provisionMailDomain(domain.domain,policy,cloudflareDomainSetup,{
    zoneId:domain.cloudflareZoneId,
    routingEnabled:domain.routingEnabled,
    sendingEnabled:domain.sendingEnabled,
    sendingAuthVerified:domain.spfStatus==='verified'&&domain.dkimStatus==='verified'&&domain.dmarcStatus==='verified',
  });
  await saveMailDomainSetup(domain.id,tenant.id,workspace.id,result);
  if(result.routingEnabled) await setDefaultMailDomain(workspace.id,domain.id);
  revalidatePath(`/app/${tenantSlug}/mail`);
  redirect(`/app/${tenantSlug}/mail/domains?domain=${encodeURIComponent(domain.domain)}&setup=${getSetupResult(result,policy)}`);
}

const cloudflareDomainSetup={
  findZone:findCloudflareZone,
  getRouting:getCloudflareEmailRouting,
  enableRouting:enableCloudflareEmailRouting,
  getSending:getCloudflareEmailSending,
  enableSending:enableCloudflareEmailSending,
  getSendingDns:getCloudflareEmailSendingDns,
  ensureSendingDns:ensureCloudflareEmailSendingDns,
  getPublicSendingDns:getPublicCloudflareSendingDns,
  ensureEventSubscription:ensureCloudflareEmailEventSubscription,
  verifyAuthRecords:areCloudflareEmailAuthRecordsPublished,
};

function getSetupResult(result:Awaited<ReturnType<typeof provisionMailDomain>>,policy:ReturnType<typeof getMailDomainProvisioningPolicy>){
  if(result.failed) return 'error';
  if(!result.zoneId) return 'guided';
  return result.sendingAuthVerified&&(!policy.configureRouting||result.routingEnabled)?'ready':'waiting';
}

async function saveMailDomainSetup(
  domainId:string,
  tenantId:string,
  workspaceId:string,
  result:Awaited<ReturnType<typeof provisionMailDomain>>,
){
  const sendingAuthVerified=result.sendingAuthVerified;
  await db.update(mailDomains).set({
    status:result.routingEnabled&&sendingAuthVerified?'ready':result.routingEnabled?'routing_ready':sendingAuthVerified?'sending_ready':'pending',
    cloudflareZoneId:result.zoneId,
    routingEnabled:result.routingEnabled,
    sendingEnabled:result.sendingEnabled,
    mxStatus:result.routingEnabled?'verified':'pending',
    spfStatus:sendingAuthVerified?'verified':'pending',
    dkimStatus:sendingAuthVerified?'verified':'pending',
    dmarcStatus:sendingAuthVerified?'verified':'pending',
  }).where(and(eq(mailDomains.id,domainId),eq(mailDomains.tenantId,tenantId),eq(mailDomains.workspaceId,workspaceId)));
}

async function setDefaultMailDomain(workspaceId:string,domainId:string){
  await db.update(mailWorkspaces).set({defaultDomainId:domainId,onboardingStep:'mailbox',updatedAt:new Date()}).where(eq(mailWorkspaces.id,workspaceId));
}
