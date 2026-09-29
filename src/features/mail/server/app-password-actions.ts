'use server';

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { mailAppPasswords, mailMailboxes, mailMailboxMembers } from '@/shared/db/schema';

import { mailExternalClientsEnabled } from './external-clients';
import { requireMailWorkspaceAccess } from './workspace';

type State={secret?:string;error?:string};

function bytes(length:number){
  const value=new Uint8Array(length);
  crypto.getRandomValues(value);
  return value;
}
function hex(value:Uint8Array){return Array.from(value,(v)=>v.toString(16).padStart(2,'0')).join('');}
function base64(value:Uint8Array){
  let binary='';
  for(const byte of value) binary+=String.fromCharCode(byte);
  return btoa(binary);
}
async function ssha256(secret:string){
  const salt=bytes(16);
  const input=new Uint8Array(new TextEncoder().encode(secret).length+salt.length);
  input.set(new TextEncoder().encode(secret),0);
  input.set(salt,input.length-salt.length);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',input));
  const combined=new Uint8Array(digest.length+salt.length);
  combined.set(digest,0); combined.set(salt,digest.length);
  return '{SSHA256}'+base64(combined);
}

export async function createMailAppPassword(tenantSlug:string,_state:State,formData:FormData):Promise<State>{
  if(!mailExternalClientsEnabled()) return {error:'External mail-app access is not enabled yet.'};
  const {actor,tenant,membership}=await requireMailWorkspaceAccess(tenantSlug);
  const mailboxId=String(formData.get('mailboxId')||'');
  const name=String(formData.get('name')||'').trim().slice(0,128);
  if(!mailboxId||!name) return {error:'Choose a mailbox and name this device.'};
  const mailbox=await db.query.mailMailboxes.findFirst({where:and(eq(mailMailboxes.id,mailboxId),eq(mailMailboxes.tenantId,tenant.id),eq(mailMailboxes.status,'active'))});
  if(!mailbox) return {error:'Mailbox not found.'};
  if(!['admin','manager'].includes(String(membership.role))){
    const member=await db.query.mailMailboxMembers.findFirst({where:and(eq(mailMailboxMembers.mailboxId,mailbox.id),eq(mailMailboxMembers.userId,actor.userId))});
    if(!member) return {error:'You do not have access to this mailbox.'};
  }
  const secret='mkmail-'+hex(bytes(12));
  const passwordHash=await ssha256(secret);
  await db.update(mailAppPasswords).set({revokedAt:new Date()}).where(and(eq(mailAppPasswords.tenantId,tenant.id),eq(mailAppPasswords.mailboxId,mailbox.id),eq(mailAppPasswords.userId,actor.userId),isNull(mailAppPasswords.revokedAt)));
  await db.insert(mailAppPasswords).values({
    tenantId:tenant.id,mailboxId:mailbox.id,userId:actor.userId,name,passwordPrefix:secret.slice(0,12),passwordHash,
  });
  return {secret};
}

export async function revokeMailAppPassword(tenantSlug:string,formData:FormData){
  const {actor,tenant,membership}=await requireMailWorkspaceAccess(tenantSlug);
  const id=String(formData.get('id')||'');
  const credential=await db.query.mailAppPasswords.findFirst({where:and(eq(mailAppPasswords.id,id),eq(mailAppPasswords.tenantId,tenant.id))});
  if(!credential) return;
  if(credential.userId!==actor.userId&&!['admin','manager'].includes(String(membership.role))) return;
  await db.update(mailAppPasswords).set({revokedAt:new Date()}).where(and(eq(mailAppPasswords.id,id),eq(mailAppPasswords.tenantId,tenant.id)));
}
