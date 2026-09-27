import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailCustomerUpdateRecipients, mailDomains, mailMessages } from '@/shared/db/schema';

export type MailCapacity={
  allowed:boolean;
  limit:number;
  used:number;
  remaining:number;
  reason?:'warmup'|'daily_limit';
};

function configuredLimit(){
  const value=Number(process.env.MKETY_MAIL_DAILY_SEND_LIMIT||3000);
  return Number.isFinite(value)&&value>0?Math.floor(value):3000;
}

function domainLimit(createdAt:Date){
  const ageHours=Math.max(0,(Date.now()-createdAt.getTime())/3_600_000);
  const platformLimit=configuredLimit();
  if(ageHours<24) return Math.min(platformLimit,500);
  if(ageHours<72) return Math.min(platformLimit,1500);
  return platformLimit;
}

export async function getMailSendCapacity(tenantId:string,domainId:string,requested=1):Promise<MailCapacity>{
  const domain=await db.query.mailDomains.findFirst({
    where:and(eq(mailDomains.id,domainId),eq(mailDomains.tenantId,tenantId)),
    columns:{createdAt:true},
  });
  if(!domain) return {allowed:false,limit:0,used:0,remaining:0,reason:'daily_limit'};

  const since=new Date(Date.now()-24*60*60*1000);
  const [messageRows,updateRows]=await Promise.all([
    db.select({value:count()}).from(mailMessages).where(and(
      eq(mailMessages.tenantId,tenantId),
      eq(mailMessages.direction,'outbound'),
      gte(mailMessages.createdAt,since),
    )),
    db.select({value:count()}).from(mailCustomerUpdateRecipients).where(and(
      eq(mailCustomerUpdateRecipients.tenantId,tenantId),
      gte(mailCustomerUpdateRecipients.createdAt,since),
    )),
  ]);
  const used=Number(messageRows[0]?.value||0)+Number(updateRows[0]?.value||0);
  const limit=domainLimit(domain.createdAt);
  const remaining=Math.max(0,limit-used);
  return {
    allowed:requested<=remaining,
    limit,
    used,
    remaining,
    reason:requested<=remaining?undefined:(limit<configuredLimit()?'warmup':'daily_limit'),
  };
}
