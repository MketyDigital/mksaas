import { parseMime } from './mime';

type MailHeaders={
  get(name:string):string|null;
};

type MailRaw=ReadableStream<Uint8Array>|ArrayBuffer|Uint8Array|string;

type EmailMessage={
  to:string;
  from:string;
  raw:MailRaw;
  rawSize:number;
  headers:MailHeaders;
  forward(address:string):Promise<void>;
  setReject(reason:string):void;
};

type MailBucket={
  put(key:string,value:MailRaw,options?:{
    httpMetadata?:{contentType?:string};
    customMetadata?:Record<string,string>;
  }):Promise<unknown>;
};

type Env={
  MAIL_STORAGE:MailBucket;
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
  async email(message:EmailMessage,env:Env):Promise<void>{
    const resolvedResponse=await internal(env,env.MKETY_MAIL_RESOLVE_URL,{recipient:message.to});
    const resolved=await resolvedResponse.json().catch(()=>null) as Resolution|null;
    if(!resolvedResponse.ok||!resolved?.accepted||!resolved.tenantId||!resolved.mailboxId){
      message.setReject('Mailbox does not exist');
      return;
    }

    if(resolved.forwardingAddress){
      await message.forward(resolved.forwardingAddress);
    }

    const messageObjectId=crypto.randomUUID();
    const baseKey=`mail/${resolved.tenantId}/${resolved.mailboxId}/${messageObjectId}`;
    const rawKey=`${baseKey}/raw.eml`;
    const rawBuffer=await new Response(message.raw as BodyInit).arrayBuffer();
    const rawBytes=new Uint8Array(rawBuffer);
    const parsed=parseMime(rawBytes);

    await env.MAIL_STORAGE.put(rawKey,rawBuffer,{
      httpMetadata:{contentType:'message/rfc822'},
      customMetadata:{tenantId:resolved.tenantId,mailboxId:resolved.mailboxId},
    });

    let htmlR2Key:string|undefined;
    let textR2Key:string|undefined;
    if(parsed.html){
      htmlR2Key=`${baseKey}/body.html`;
      await env.MAIL_STORAGE.put(htmlR2Key,parsed.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
    }
    if(parsed.text){
      textR2Key=`${baseKey}/body.txt`;
      await env.MAIL_STORAGE.put(textR2Key,parsed.text,{httpMetadata:{contentType:'text/plain; charset=utf-8'}});
    }

    const attachmentManifest:Array<{filename:string;contentType:string;r2Key:string;size:number}>=[];
    for(let index=0;index<parsed.attachments.length;index++){
      const attachment=parsed.attachments[index];
      const attachmentKey=`${baseKey}/attachments/${String(index+1).padStart(3,'0')}-${attachment.filename}`;
      await env.MAIL_STORAGE.put(attachmentKey,attachment.bytes,{httpMetadata:{contentType:attachment.contentType}});
      attachmentManifest.push({filename:attachment.filename,contentType:attachment.contentType,r2Key:attachmentKey,size:attachment.bytes.byteLength});
    }
    if(attachmentManifest.length){
      await env.MAIL_STORAGE.put(`${baseKey}/attachments.json`,JSON.stringify(attachmentManifest),{httpMetadata:{contentType:'application/json'}});
    }

    const preview=(parsed.text||parsed.html.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim().slice(0,240);
    const ingest=await internal(env,env.MKETY_MAIL_INGEST_URL,{
      tenantId:resolved.tenantId,
      mailboxId:resolved.mailboxId,
      from:message.from,
      to:message.to,
      subject:message.headers.get('subject')||'',
      internetMessageId:message.headers.get('message-id')||'',
      rawR2Key:rawKey,
      htmlR2Key,
      textR2Key,
      preview,
      attachmentCount:attachmentManifest.length,
      rawSize:message.rawSize,
      automated:Boolean(message.headers.get('x-mkety-auto-reply')||message.headers.get('auto-submitted')),
    });
    if(!ingest.ok) throw new Error('Mkety Mail ingest failed.');
  },
};
