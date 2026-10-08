const API='https://api.cloudflare.com/client/v4';

function env(){
  const token=process.env.MKETY_DEPLOY_CLOUDFLARE_API_TOKEN||process.env.CLOUDFLARE_API_TOKEN||'';
  const accountId=process.env.MKETY_DEPLOY_CLOUDFLARE_ACCOUNT_ID||process.env.CLOUDFLARE_ACCOUNT_ID||'';
  return {token,accountId};
}

async function cfFetch(path:string,init:RequestInit={}){
  const {token}=env();
  if(!token) throw new Error('Cloudflare mail automation is not configured.');
  const response=await fetch(API+path,{
    ...init,
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(init.headers||{})},
  });
  const payload=await response.json().catch(()=>null) as {
    success?:boolean;
    errors?:Array<{message?:string}>;
    result?:unknown;
  }|null;
  if(!response.ok||payload?.success===false) throw new Error(String(payload?.errors?.[0]?.message||'Cloudflare request failed.'));
  return payload;
}

export async function findCloudflareZone(domain:string){
  const payload=await cfFetch('/zones?name='+encodeURIComponent(domain)+'&status=active&per_page=10');
  const result=Array.isArray(payload?.result)?payload.result as Array<{id?:string;name?:string}>:[];
  const zone=result[0]||null;
  return zone?{id:String(zone.id),name:String(zone.name)}:null;
}



export async function setCloudflareEmailCatchAll(zoneId:string,workerName='mkety-mail-ingress'){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/rules/catch_all`,{
    method:'PUT',
    body:JSON.stringify({
      name:'Mkety Mail catch-all',
      enabled:true,
      matchers:[{type:'all'}],
      actions:[{type:'worker',value:[workerName]}],
      source:'api',
    }),
  });
  return (payload?.result as {id?:string}|undefined)||null;
}

export async function createCloudflareEmailWorkerRule(zoneId:string,address:string,workerName='mkety-mail-ingress'){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/rules`,{
    method:'POST',
    body:JSON.stringify({
      name:`Mkety Mail · ${address}`,
      enabled:true,
      matchers:[{type:'literal',field:'to',value:address}],
      actions:[{type:'worker',value:[workerName]}],
      source:'api',
    }),
  });
  return (payload?.result as {id?:string}|undefined)||null;
}

export async function enableCloudflareEmailRouting(zoneId:string,domain:string){
  return cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/dns`,{
    method:'POST',
    body:JSON.stringify({name:domain}),
  });
}


export async function getCloudflareEmailSending(zoneId:string,domain:string){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains?per_page=100`);
  const rows=Array.isArray(payload?.result)?payload.result as Array<Record<string,unknown>>:[];
  return rows.find((row)=>row.name===domain)||null;
}

export async function enableCloudflareEmailSending(zoneId:string,domain:string){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains`,{
    method:'POST',
    body:JSON.stringify({name:domain}),
  });
  return (payload?.result as Record<string,unknown>|undefined)||null;
}

export async function getCloudflareEmailRouting(zoneId:string){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing`);
  return (payload?.result as Record<string,unknown>|undefined)||null;
}


export async function ensureCloudflareEmailEventSubscription(zoneId:string,domain:string){
  const {accountId}=env();
  const queueId=process.env.MKETY_MAIL_EVENT_QUEUE_ID||'';
  if(!accountId||!queueId) return null;

  const listed=await cfFetch(`/accounts/${encodeURIComponent(accountId)}/event_subscriptions/subscriptions?per_page=100`);
  const rows=Array.isArray(listed?.result)?listed.result as Array<{
    id?:string;
    source?:{type?:string;zone_id?:string;zoneId?:string;domain?:string};
    destination?:{type?:string;queue_id?:string};
  }>:[];
  const existing=rows.find((row)=>
    row.source?.type==='email.sending'&&
    (row.source.zone_id===zoneId||row.source.zoneId===zoneId)&&
    row.source.domain===domain&&
    row.destination?.queue_id===queueId
  );
  if(existing) return existing;

  const created=await cfFetch(`/accounts/${encodeURIComponent(accountId)}/event_subscriptions/subscriptions`,{
    method:'POST',
    body:JSON.stringify({
      name:`Mkety Mail · ${domain}`,
      enabled:true,
      source:{type:'email.sending',zone_id:zoneId,domain},
      destination:{type:'queues.queue',queue_id:queueId},
      events:[
        'message.delivered',
        'message.deferred',
        'message.bounced',
        'message.failed',
        'message.rejected',
        'message.complained',
      ],
    }),
  });
  return created?.result||null;
}

export async function sendCloudflareEmail(input:{
  from:{email:string;name?:string};
  to:Array<{email:string;name?:string}>;
  subject:string;
  html?:string;
  text?:string;
  cc?:Array<{email:string;name?:string}>;
  bcc?:Array<{email:string;name?:string}>;
  headers?:Record<string,string>;
}){
  const {accountId}=env();
  if(!accountId) throw new Error('Cloudflare account ID is not configured.');
  const payload=await cfFetch(`/accounts/${encodeURIComponent(accountId)}/email/sending/send`,{
    method:'POST',
    body:JSON.stringify(input),
  });
  return payload?.result||payload;
}

export async function pushMailQueueBatch(messages:Array<Record<string,unknown>>){
  const {accountId}=env();
  const queueId=process.env.MKETY_MAIL_QUEUE_ID||'';
  if(!accountId||!queueId) throw new Error('Mkety Mail dispatch queue is not configured.');
  const payload=await cfFetch(`/accounts/${encodeURIComponent(accountId)}/queues/${encodeURIComponent(queueId)}/messages/batch`,{
    method:'POST',
    body:JSON.stringify({
      messages:messages.map((body)=>({body,content_type:'json'})),
    }),
  });
  return payload?.result||payload;
}
