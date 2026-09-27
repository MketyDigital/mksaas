type Env={
  MAIL_STORAGE:R2Bucket;
  MKETY_MAIL_INTERNAL_SECRET:string;
  MKETY_MAIL_RESOLVE_URL:string;
  MKETY_MAIL_INGEST_URL:string;
};

type Resolution={
  ok?:boolean;
  accepted?:boolean;
  tenantId?:string;
  mailboxId?:string;
  forwardingAddress?:string|null;
};

async function internal(env:Env,url:string,payload:Record<string,unknown>){
  return fetch(url,{
    method:'POST',
    headers:{authorization:`Bearer ${env.MKETY_MAIL_INTERNAL_SECRET}`,'content-type':'application/json'},
    body:JSON.stringify(payload),
  });
}

export default {
  async fetch():Promise<Response>{
    return new Response('Mkety Mail ingress',{status:200});
  },
  async email(message:ForwardableEmailMessage,env:Env):Promise<void>{
    const resolvedResponse=await internal(env,env.MKETY_MAIL_RESOLVE_URL,{recipient:message.to});
    const resolved=await resolvedResponse.json().catch(()=>null) as Resolution|null;
    if(!resolvedResponse.ok||!resolved?.accepted||!resolved.tenantId||!resolved.mailboxId){
      message.setReject('Mailbox does not exist');
      return;
    }

    if(resolved.forwardingAddress){
      await message.forward(resolved.forwardingAddress);
    }

    const rawKey=`mail/${resolved.tenantId}/${resolved.mailboxId}/${crypto.randomUUID()}.eml`;
    await env.MAIL_STORAGE.put(rawKey,message.raw,{
      httpMetadata:{contentType:'message/rfc822'},
      customMetadata:{
        tenantId:resolved.tenantId,
        mailboxId:resolved.mailboxId,
      },
    });

    const ingest=await internal(env,env.MKETY_MAIL_INGEST_URL,{
      tenantId:resolved.tenantId,
      mailboxId:resolved.mailboxId,
      from:message.from,
      to:message.to,
      subject:message.headers.get('subject')||'',
      internetMessageId:message.headers.get('message-id')||'',
      rawR2Key:rawKey,
      rawSize:message.rawSize,
      automated:Boolean(message.headers.get('x-mkety-auto-reply')||message.headers.get('auto-submitted')),
    });
    if(!ingest.ok) throw new Error('Mkety Mail ingest failed.');
  },
};
