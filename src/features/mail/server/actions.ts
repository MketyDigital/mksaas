'use server';

import { redirect } from 'next/navigation';

import { enableMailWorkspace } from './workspace';

export async function enableMketyMail(tenantSlug:string){
  await enableMailWorkspace(tenantSlug);
  redirect(`/app/${tenantSlug}/mail`);
}
