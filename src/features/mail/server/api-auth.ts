import { eq } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailApiKeys } from '@/shared/db/schema';

async function sha256(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,'0')).join('');
}

export async function authenticateMailApiKey(request:Request){
  const auth=request.headers.get('authorization')||'';
  const key=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!key.startsWith('mk_mail_live_')||key.length<32) return null;
  const keyHash=await sha256(key);
  const row=await db.query.mailApiKeys.findFirst({where:eq(mailApiKeys.keyHash,keyHash)});
  if(!row||row.revokedAt||(row.expiresAt&&row.expiresAt.getTime()<=Date.now())) return null;
  if(!row.scopes.includes('mail:send')) return null;
  await db.update(mailApiKeys).set({lastUsedAt:new Date()}).where(eq(mailApiKeys.id,row.id));
  return row;
}
