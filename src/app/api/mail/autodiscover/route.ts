import { NextResponse } from 'next/server';

import { mailExternalClientsEnabled } from '@/features/mail/server/external-clients';

function esc(value:string){
  return value.replace(/[<>&"']/g,(char)=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]||char));
}

export async function POST(request:Request){
  if(!mailExternalClientsEnabled()) {
    return NextResponse.json({ok:false,error:'external_mail_clients_unavailable'},{status:503,headers:{'cache-control':'no-store'}});
  }
  const raw=await request.text();
  const match=raw.match(/<EMailAddress>([^<]+)<\/EMailAddress>/i);
  const email=String(match?.[1]||'');
  if(!email.includes('@')) return new NextResponse('Invalid request',{status:400});
  const body=`<?xml version="1.0" encoding="utf-8"?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
<Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
<Account><AccountType>email</AccountType><Action>settings</Action>
<Protocol><Type>IMAP</Type><Server>imap.mkety.com</Server><Port>993</Port><LoginName>${esc(email)}</LoginName><SSL>on</SSL><AuthRequired>on</AuthRequired></Protocol>
<Protocol><Type>SMTP</Type><Server>smtp.mkety.com</Server><Port>465</Port><LoginName>${esc(email)}</LoginName><SSL>on</SSL><AuthRequired>on</AuthRequired></Protocol>
</Account></Response></Autodiscover>`;
  return new NextResponse(body,{headers:{'content-type':'application/xml; charset=utf-8'}});
}
