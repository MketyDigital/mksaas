type QueueMessage<T>={
  body:T;
  ack():void;
  retry(options?:{delaySeconds?:number}):void;
};

type QueueBatch<T>={
  messages:Array<QueueMessage<T>>;
};

type MailEvent={
  type:string;
  source?:{type?:string;domain?:string;zoneId?:string};
  payload?:Record<string,unknown>;
  metadata?:Record<string,unknown>;
};

type Env={
  MKETY_MAIL_INTERNAL_SECRET:string;
  MKETY_MAIL_EVENT_CALLBACK_URL:string;
};

export default {
  async fetch():Promise<Response>{
    return new Response('Mkety Mail events',{status:200});
  },
  async queue(batch:QueueBatch<MailEvent>,env:Env):Promise<void>{
    for(const message of batch.messages){
      try{
        const response=await fetch(env.MKETY_MAIL_EVENT_CALLBACK_URL,{
          method:'POST',
          headers:{authorization:`Bearer ${env.MKETY_MAIL_INTERNAL_SECRET}`,'content-type':'application/json'},
          body:JSON.stringify(message.body),
        });
        if(!response.ok) throw new Error('Mkety Mail event callback failed.');
        message.ack();
      }catch{
        message.retry({delaySeconds:30});
      }
    }
  },
};
