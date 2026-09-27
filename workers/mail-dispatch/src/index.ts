type QueueMessage<T>={
  body:T;
  ack():void;
  retry(options?:{delaySeconds?:number}):void;
};

type QueueBatch<T>={
  messages:Array<QueueMessage<T>>;
};

type MailJob={
  kind:'customer_update';
  tenantId:string;
  updateId:string;
  recipientId:string;
  from:{email:string;name?:string};
  to:{email:string;name?:string};
  subject:string;
  html?:string;
  text?:string;
};

type Env={
  CLOUDFLARE_ACCOUNT_ID:string;
  CLOUDFLARE_API_TOKEN:string;
  MKETY_MAIL_INTERNAL_SECRET:string;
  MKETY_MAIL_CALLBACK_URL:string;
};

async function report(env:Env,job:MailJob,result:{status:'sent'|'failed';providerMessageId?:string;errorCode?:string}){
  const response=await fetch(env.MKETY_MAIL_CALLBACK_URL,{
    method:'POST',
    headers:{authorization:`Bearer ${env.MKETY_MAIL_INTERNAL_SECRET}`,'content-type':'application/json'},
    body:JSON.stringify({
      tenantId:job.tenantId,
      updateId:job.updateId,
      recipientId:job.recipientId,
      recipient:job.to.email,
      ...result,
    }),
  });
  if(!response.ok) throw new Error('Mkety Mail callback failed.');
}

async function send(env:Env,job:MailJob){
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/email/sending/send`,{
    method:'POST',
    headers:{authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,'content-type':'application/json'},
    body:JSON.stringify({
      from:job.from,
      to:[job.to],
      subject:job.subject,
      ...(job.html?{html:job.html}:{}),
      ...(job.text?{text:job.text}:{}),
    }),
  });
  const payload=await response.json().catch(()=>null) as {success?:boolean;result?:{id?:string};errors?:Array<{code?:number;message?:string}>}|null;
  if(!response.ok||payload?.success===false){
    const error=payload?.errors?.[0];
    await report(env,job,{status:'failed',errorCode:String(error?.code||response.status)});
    return;
  }
  await report(env,job,{status:'sent',providerMessageId:String(payload?.result?.id||'')||undefined});
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
