type QueueMessage<T>={
  body:T;
  ack():void;
  retry(options?:{delaySeconds?:number}):void;
};

type QueueBatch<T>={
  messages:Array<QueueMessage<T>>;
};

type MailAddress={email:string;name?:string};

type MailJob={
  kind:'customer_update'|'transactional'|'inbox';
  tenantId:string;
  messageId?:string;
  mailboxId?:string;
  updateId?:string;
  recipientId?:string;
  from:MailAddress;
  to:MailAddress;
  cc?:MailAddress[];
  bcc?:MailAddress[];
  replyTo?:MailAddress;
  subject:string;
  html?:string;
  text?:string;
  headers?:Record<string,string>;
};

type EmailSendResult={messageId:string};
type EmailBinding={
  send(message:{
    from:string|MailAddress;
    to:string|MailAddress|Array<string|MailAddress>;
    cc?:Array<string|MailAddress>;
    bcc?:Array<string|MailAddress>;
    replyTo?:string|MailAddress;
    subject:string;
    html?:string;
    text?:string;
    headers?:Record<string,string>;
  }):Promise<EmailSendResult>;
};

type MailBucket={
  put(key:string,value:string,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;
};

type Env={
  EMAIL:EmailBinding;
  MAIL_STORAGE:MailBucket;
  MKETY_MAIL_INTERNAL_SECRET:string;
  MKETY_MAIL_CALLBACK_URL:string;
};

function providerFailure(error:unknown){
  const value=error as {name?:unknown;code?:unknown;message?:unknown}|null;
  const name=typeof value?.name==='string'?value.name:'';
  const code=value?.code===undefined?'':String(value.code).trim().slice(0,64);
  const raw=typeof value?.message==='string'?value.message:String(error||'');
  const detail=raw
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[redacted-email]')
    .replace(/\bBearer\s+\S+/gi,'Bearer [redacted]')
    .replace(/(token|secret|password|api[-_ ]?key)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]')
    .replace(/[\r\n\t\u0000-\u001f]+/g,' ')
    .trim()
    .slice(0,500);
  return {errorCode:code||name||'send_failed',errorDetail:detail||'Email provider rejected the send request.'};
}

async function report(env:Env,job:MailJob,result:{status:'sent'|'failed';providerMessageId?:string;errorCode?:string;errorDetail?:string;textR2Key?:string;htmlR2Key?:string}){
  const response=await fetch(env.MKETY_MAIL_CALLBACK_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${env.MKETY_MAIL_INTERNAL_SECRET}`,'content-type':'application/json'},
    body:JSON.stringify({
      kind:job.kind,
      tenantId:job.tenantId,
      messageId:job.messageId,
      mailboxId:job.mailboxId,
      updateId:job.updateId,
      recipientId:job.recipientId,
      recipient:job.to.email,
      ...result,
    }),
  });
  if(!response.ok) throw new Error('Mkety Mail callback failed.');
}

async function send(env:Env,job:MailJob){
  let textR2Key:string|undefined;
  let htmlR2Key:string|undefined;
  if(job.messageId&&job.mailboxId){
    const base=`mail/${job.tenantId}/${job.mailboxId}/outbound/${job.messageId}`;
    if(job.text){
      textR2Key=`${base}/body.txt`;
      await env.MAIL_STORAGE.put(textR2Key,job.text,{httpMetadata:{contentType:'text/plain; charset=utf-8'}});
    }
    if(job.html){
      htmlR2Key=`${base}/body.html`;
      await env.MAIL_STORAGE.put(htmlR2Key,job.html,{httpMetadata:{contentType:'text/html; charset=utf-8'}});
    }
  }
  let result:EmailSendResult;
  try{
    result=await env.EMAIL.send({
      from:job.from,
      to:job.to,
      ...(job.cc?.length?{cc:job.cc}:{}),
      ...(job.bcc?.length?{bcc:job.bcc}:{}),
      ...(job.replyTo?{replyTo:job.replyTo}:{}),
      subject:job.subject,
      ...(job.html?{html:job.html}:{}),
      ...(job.text?{text:job.text}:{}),
      ...(job.headers?{headers:job.headers}:{}),
    });
  }catch(error){
    const failure=providerFailure(error);
    console.error('MKETY_MAIL_PROVIDER_SEND_FAILED',JSON.stringify({messageId:job.messageId||null,...failure}));
    await report(env,job,{status:'failed',...failure,textR2Key,htmlR2Key});
    return;
  }

  try{
    await report(env,job,{status:'sent',providerMessageId:result.messageId,textR2Key,htmlR2Key});
  }catch(error){
    // Cloudflare has accepted the message. Do not retry the queue item and risk
    // sending a duplicate just because the app callback is temporarily unavailable.
    const failure=providerFailure(error);
    console.error('MKETY_MAIL_ACCEPTED_STATUS_CALLBACK_FAILED',JSON.stringify({messageId:job.messageId||null,...failure}));
  }
}

export default {
  async fetch():Promise<Response>{
    return new Response('Mkety Mail dispatch',{status:200});
  },
  async queue(batch:QueueBatch<MailJob>,env:Env):Promise<void>{
    for(const message of batch.messages){
      try{
        await send(env,message.body);
        message.ack();
      }catch{
        message.retry({delaySeconds:30});
      }
    }
  },
};
