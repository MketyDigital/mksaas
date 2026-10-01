'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/shared/db/cloudflare';
import { mailContacts } from '@/shared/db/schema';

import { requireMailWorkspaceAccess } from './workspace';

function validEmail(value:string){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCsvLine(line:string){
  const fields:string[]=[];
  let value='';
  let quoted=false;
  for(let i=0;i<line.length;i++){
    const char=line[i];
    if(char==='"'){
      if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;
    }else if(char===','&&!quoted){fields.push(value.trim());value='';}
    else value+=char;
  }
  fields.push(value.trim());
  return fields;
}

export async function addMailContact(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const email=String(formData.get('email')||'').trim().toLowerCase();
  const name=String(formData.get('name')||'').trim().slice(0,255);
  const company=String(formData.get('company')||'').trim().slice(0,255);
  const tags=String(formData.get('tags')||'').split(',').map((v)=>v.trim()).filter(Boolean).slice(0,20);
  if(!validEmail(email)) redirect(`/app/${tenantSlug}/mail/contacts?error=email`);
  await db.insert(mailContacts).values({
    tenantId:tenant.id,email,name:name||null,company:company||null,tags,source:'manual',status:'active',
  }).onConflictDoUpdate({
    target:[mailContacts.tenantId,mailContacts.email],
    set:{name:name||null,company:company||null,tags,status:'active',updatedAt:new Date()},
  });
  revalidatePath(`/app/${tenantSlug}/mail/contacts`);
  redirect(`/app/${tenantSlug}/mail/contacts?added=1`);
}

export async function importMailContactsCsv(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const file=formData.get('file');
  if(!(file instanceof File)||file.size<=0||file.size>2_000_000){
    redirect(`/app/${tenantSlug}/mail/contacts?error=file`);
  }
  const text=await file.text();
  const lines=text.split(/\r?\n/).map((v)=>v.trim()).filter(Boolean);
  if(!lines.length) redirect(`/app/${tenantSlug}/mail/contacts?error=file`);

  const header=parseCsvLine(lines[0]).map((v)=>v.toLowerCase());
  const emailIndex=header.findIndex((v)=>['email','email address','email_address'].includes(v));
  const nameIndex=header.findIndex((v)=>['name','full name','full_name'].includes(v));
  const companyIndex=header.findIndex((v)=>['company','business','organization'].includes(v));
  const tagsIndex=header.findIndex((v)=>['tags','tag'].includes(v));
  if(emailIndex<0) redirect(`/app/${tenantSlug}/mail/contacts?error=columns`);

  const records=new Map<string,{email:string;name:string|null;company:string|null;tags:string[]}>();
  for(const line of lines.slice(1,3001)){
    const fields=parseCsvLine(line);
    const email=String(fields[emailIndex]||'').trim().toLowerCase();
    if(!validEmail(email)) continue;
    records.set(email,{
      email,
      name:nameIndex>=0?String(fields[nameIndex]||'').trim().slice(0,255)||null:null,
      company:companyIndex>=0?String(fields[companyIndex]||'').trim().slice(0,255)||null:null,
      tags:tagsIndex>=0?String(fields[tagsIndex]||'').split(/[;|]/).map((v)=>v.trim()).filter(Boolean).slice(0,20):[],
    });
  }
  const values=[...records.values()].map((record)=>({...record,tenantId:tenant.id,source:'csv',status:'active'}));
  if(values.length){
    await db.insert(mailContacts).values(values).onConflictDoNothing({target:[mailContacts.tenantId,mailContacts.email]});
  }
  revalidatePath(`/app/${tenantSlug}/mail/contacts`);
  redirect(`/app/${tenantSlug}/mail/contacts?imported=${values.length}`);
}

export async function archiveMailContact(tenantSlug:string,formData:FormData){
  const {tenant}=await requireMailWorkspaceAccess(tenantSlug);
  const id=String(formData.get('id')||'');
  await db.update(mailContacts).set({status:'archived',updatedAt:new Date()}).where(and(eq(mailContacts.id,id),eq(mailContacts.tenantId,tenant.id)));
  revalidatePath(`/app/${tenantSlug}/mail/contacts`);
}
