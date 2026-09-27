'use server';

import { and, eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailApiKeys } from '@/shared/db/schema';

import { requireMailWorkspaceAccess } from './workspace';

type ApiKeyState={secret?:string;error?:string};

function randomHex(bytes:number){
  const value=new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value,(byte)=>byte.toString(16).padStart(2,'0')).join('');
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,'0')).join('');
}

export async function createMailApiKey(tenantSlug:string,_state:ApiKeyState,formData:FormData):Promise<ApiKeyState>{
  const {actor,tenant,membership}=await requireMailWorkspaceAccess(tenantSlug);
  if(!['admin','manager'].includes(String(membership.role))) return {error:'Only workspace admins and managers can create API keys.'};
  const name=String(formData.get('name')||'').trim().slice(0,128);
  if(!name) return {error:'Give this API key a name.'};

  const secret=`mk_mail_live_${randomHex(24)}`;
  const keyHash=await sha256(secret);
  await db.insert(mailApiKeys).values({
    tenantId:tenant.id,
    name,
    keyPrefix:secret.slice(0,20),
    keyHash,
    scopes:['mail:send'],
    createdByUserId:actor.userId,
  });
  return {secret};
}

export async function revokeMailApiKey(tenantSlug:string,formData:FormData){
  const {tenant,membership}=await requireMailWorkspaceAccess(tenantSlug);
  if(!['admin','manager'].includes(String(membership.role))) return;
  const id=String(formData.get('id')||'');
  await db.update(mailApiKeys).set({revokedAt:new Date()}).where(and(eq(mailApiKeys.id,id),eq(mailApiKeys.tenantId,tenant.id)));
}
