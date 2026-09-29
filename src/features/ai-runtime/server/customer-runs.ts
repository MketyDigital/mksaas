import { desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiRequests, aiSolutionInstances } from '@/shared/db/schema/ai-runtime';

export async function listEnterpriseAiCustomerRuns(tenantId:string,limit=100){
  const rows=await db.select({
    id:aiRequests.id,
    solutionId:sql<string|null>`${aiRequests.providerCostMetadata}->>'solutionInstanceId'`,
    modelAlias:aiRequests.modelAlias,
    providerKey:aiRequests.providerKey,
    status:aiRequests.status,
    inputTokens:aiRequests.inputTokens,
    cachedInputTokens:aiRequests.cachedInputTokens,
    outputTokens:aiRequests.outputTokens,
    reservedCredits:aiRequests.reservedCredits,
    settledCredits:aiRequests.settledCredits,
    errorCode:aiRequests.errorCode,
    startedAt:aiRequests.startedAt,
    completedAt:aiRequests.completedAt,
  })
    .from(aiRequests)
    .where(sql`${aiRequests.tenantId} = ${tenantId} AND ${aiRequests.providerCostMetadata}->>'solutionInstanceId' IS NOT NULL`)
    .orderBy(desc(aiRequests.startedAt))
    .limit(Math.max(1,Math.min(250,limit)));

  const ids=[...new Set(rows.map((item)=>item.solutionId).filter((value):value is string=>Boolean(value)))];
  const solutions=ids.length
    ? await db.select({id:aiSolutionInstances.id,name:aiSolutionInstances.name})
        .from(aiSolutionInstances)
        .where(inArray(aiSolutionInstances.id,ids))
    : [];
  const solutionNameById=new Map(solutions.map((item)=>[item.id,item.name]));
  return rows.map((item)=>({
    ...item,
    solutionName:item.solutionId?solutionNameById.get(item.solutionId)??'Enterprise AI':'Enterprise AI',
  }));
}

export async function getEnterpriseAiCustomerRun(tenantId:string,requestId:string){
  const [row]=await db.select({
    id:aiRequests.id,
    solutionId:sql<string|null>`${aiRequests.providerCostMetadata}->>'solutionInstanceId'`,
    modelAlias:aiRequests.modelAlias,
    providerKey:aiRequests.providerKey,
    nativeModel:aiRequests.nativeModel,
    status:aiRequests.status,
    inputTokens:aiRequests.inputTokens,
    cachedInputTokens:aiRequests.cachedInputTokens,
    outputTokens:aiRequests.outputTokens,
    reservedCredits:aiRequests.reservedCredits,
    settledCredits:aiRequests.settledCredits,
    errorCode:aiRequests.errorCode,
    startedAt:aiRequests.startedAt,
    completedAt:aiRequests.completedAt,
  })
    .from(aiRequests)
    .where(sql`${aiRequests.id} = ${requestId} AND ${aiRequests.tenantId} = ${tenantId} AND ${aiRequests.providerCostMetadata}->>'solutionInstanceId' IS NOT NULL`)
    .limit(1);
  if(!row) return null;
  const solution=row.solutionId
    ? await db.query.aiSolutionInstances.findFirst({
        where:eq(aiSolutionInstances.id,row.solutionId),
        columns:{name:true},
      })
    : null;
  return {...row,solutionName:solution?.name??'Enterprise AI'};
}
