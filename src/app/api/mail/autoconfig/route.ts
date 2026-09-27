import { NextResponse } from 'next/server';

function xml(value:string){
  return value.replace(/[<>&"']/g,(char)=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]||char));
}

export async function GET(request:Request){
  const url=new URL(request.url);
  const email=String(url.searchParams.get('emailaddress')||url.searchParams.get('email')||'%EMAILADDRESS%');
  const domain=email.includes('@')?email.split('@').pop()||'':'';
  const body=`<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="${xml(domain||'mkety.com')}">
    <domain>${xml(domain||'mkety.com')}</domain>
    <displayName>Mkety Mail</displayName>
    <displayShortName>Mkety</displayShortName>
    <incomingServer type="imap">
      <hostname>imap.mkety.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>smtp.mkety.com</hostname>
      <port>465</port>
      <socketType>SSL</socketType>
      <authentication>password-cleartext</authentication>
      <username>%EMAILADDRESS%</username>
    </outgoingServer>
  </emailProvider>
</clientConfig>`;
  return new NextResponse(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}});
}
