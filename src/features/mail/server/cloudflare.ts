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
  const labels=domain.split('.').filter(Boolean);
  for(let index=0;index<=labels.length-2;index+=1){
    const candidate=labels.slice(index).join('.');
    const payload=await cfFetch('/zones?name='+encodeURIComponent(candidate)+'&status=active&per_page=10');
    const result=Array.isArray(payload?.result)?payload.result as Array<{id?:string;name?:string}>:[];
    const zone=result.find((item)=>item.name===candidate&&item.id);
    if(zone) return {id:String(zone.id),name:String(zone.name)};
  }
  return null;
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

export async function getCloudflareEmailCatchAll(zoneId:string){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/rules/catch_all`);
  return (payload?.result as {id?:string;enabled?:boolean;actions?:Array<{type?:string;value?:string[]}>}|undefined)||null;
}

export async function getCloudflareZoneMailDnsRecords(zoneId:string){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500`);
  const rows=Array.isArray(payload?.result)?payload.result as Array<Record<string,unknown>>:[];
  return rows.filter((record)=>['MX','TXT'].includes(String(record.type||'').toUpperCase()))
    .filter((record)=>String(record.name||'').toLowerCase().replace(/\.$/,'')==='mkety.com')
    .map((record)=>({
      id:String(record.id||''),type:String(record.type||''),name:String(record.name||''),content:String(record.content||''),
      ttl:Number(record.ttl||0),priority:typeof record.priority==='number'?record.priority:null,proxied:record.proxied===true,
    }));
}

export async function restoreCloudflareRootMailDnsRecords(zoneId:string,snapshot:Array<Record<string,unknown>>){
  const records=snapshot.filter((record)=>['MX','TXT'].includes(String(record.type||'').toUpperCase())&&String(record.name||'').toLowerCase().replace(/\.$/,'')==='mkety.com');
  if(!records.some((record)=>String(record.type).toUpperCase()==='MX')) throw new Error('mail_rollback_snapshot_missing_mx');
  const current=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500`);
  const rows=Array.isArray(current?.result)?current.result as Array<{id?:string;type?:string;name?:string}>:[];
  const rootRecords=rows.filter((record)=>['MX','TXT'].includes(String(record.type||'').toUpperCase())&&String(record.name||'').toLowerCase().replace(/\.$/,'')==='mkety.com');
  for(const record of rootRecords) if(record.id) await cfFetch(`/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(record.id)}`,{method:'DELETE'});
  for(const record of records){
    const type=String(record.type).toUpperCase();
    const body={type,name:'mkety.com',content:String(record.content||''),ttl:Number(record.ttl||1),...(type==='MX'&&typeof record.priority==='number'?{priority:record.priority}:{})};
    await cfFetch(`/zones/${encodeURIComponent(zoneId)}/dns_records`,{method:'POST',body:JSON.stringify(body)});
  }
}

export async function getCloudflareEmailRoutingDns(zoneId:string){
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/dns`);
  return Array.isArray(payload?.result)?payload.result as Array<{type?:string;name?:string;content?:string;priority?:number}>:[];
}

export async function getPublicCloudflareDnsRecords(name:string,type:string){
  const response=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,{headers:{accept:'application/dns-json'},cache:'no-store'});
  if(!response.ok) throw new Error('Public DNS verification is unavailable.');
  const payload=await response.json() as {Answer?:Array<{name?:string;type?:number;data?:string}>};
  const codes:Record<number,string>={1:'A',5:'CNAME',15:'MX',16:'TXT',28:'AAAA'};
  return (payload.Answer||[]).flatMap((answer)=>answer.type&&answer.name&&answer.data&&codes[answer.type]?[{type:codes[answer.type],name:answer.name,content:answer.data}]:[]);
}

export async function createCloudflareEmailWorkerRule(zoneId:string,address:string,workerName='mkety-mail-ingress'){
  const list=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/rules?per_page=100`);
  const existingRows=Array.isArray(list?.result)?list.result as Array<{
    id?:string;
    matchers?:Array<{type?:string;field?:string;value?:string}>;
    actions?:Array<{type?:string;value?:string[]}>;
  }> : [];
  const existing=existingRows.find((rule)=>rule.matchers?.some((matcher)=>
    matcher.type==='literal'&&matcher.field==='to'&&matcher.value?.toLowerCase()===address.toLowerCase(),
  ));
  if(existing){
    const pointsToWorker=existing.actions?.some((action)=>action.type==='worker'&&action.value?.includes(workerName));
    if(!pointsToWorker) throw new Error('The Cloudflare recipient route is already owned by another destination.');
    return {id:existing.id};
  }
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

export async function deleteCloudflareEmailWorkerRule(zoneId:string,address:string,workerName='mkety-mail-ingress'){
  const list=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/rules?per_page=100`);
  const rows=Array.isArray(list?.result)?list.result as Array<{id?:string;matchers?:Array<{type?:string;field?:string;value?:string}>;actions?:Array<{type?:string;value?:string[]}>}>:[];
  const rule=rows.find((item)=>item.matchers?.some((matcher)=>matcher.type==='literal'&&matcher.field==='to'&&matcher.value?.toLowerCase()===address.toLowerCase()));
  if(!rule) return false;
  if(!rule.id||!rule.actions?.some((action)=>action.type==='worker'&&action.value?.includes(workerName))) throw new Error('The Cloudflare recipient route is not owned by Mkety Mail.');
  await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/rules/${encodeURIComponent(rule.id)}`,{method:'DELETE'});
  return true;
}

export async function enableCloudflareEmailRouting(zoneId:string,domain:string){
  return cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/dns`,{
    method:'POST',
    body:JSON.stringify({name:domain}),
  });
}

export async function disableCloudflareEmailRouting(zoneId:string){
  return cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/routing/dns`,{method:'DELETE'});
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

type CloudflareSendingDnsRecord={type?:string;name?:string;content?:string};

export async function getCloudflareEmailSendingDns(zoneId:string,subdomainId:string){
  if(!subdomainId) return [];
  const payload=await cfFetch(`/zones/${encodeURIComponent(zoneId)}/email/sending/subdomains/${encodeURIComponent(subdomainId)}/dns`);
  return Array.isArray(payload?.result)?payload.result as CloudflareSendingDnsRecord[]:[];
}

export async function getPublicCloudflareSendingDns(records:CloudflareSendingDnsRecord[],domain?:string){
  const authenticationRecords=records.filter((record)=>{
    const type=String(record.type||'').toUpperCase();
    const name=String(record.name||'').toLowerCase().replace(/\.$/,'');
    const content=String(record.content||'').replaceAll('"','').trim().toLowerCase();
    return (type==='TXT'&&(content.startsWith('v=spf1')||name.startsWith('_dmarc.')))||name.includes('._domainkey.')&&['TXT','CNAME'].includes(type);
  });
  if(domain){
    authenticationRecords.push({type:'TXT',name:`_dmarc.${domain}`});
  }
  const unique=[...new Map(authenticationRecords.map((record)=>[`${record.type}|${record.name}`,record])).values()];
  const typeCodes:Record<number,string>={1:'A',5:'CNAME',15:'MX',16:'TXT',28:'AAAA'};
  const answers=await Promise.all(unique.map(async(record)=>{
    const type=String(record.type||'').toUpperCase();
    const name=String(record.name||'');
    const response=await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,{headers:{accept:'application/dns-json'}});
    if(!response.ok) throw new Error('Public DNS verification is unavailable.');
    const payload=await response.json() as {Answer?:Array<{name?:string;type?:number;data?:string}>};
    return (payload.Answer||[]).flatMap((answer)=>answer.type&&answer.name&&answer.data&&typeCodes[answer.type]?[
      {type:typeCodes[answer.type],name:answer.name,content:answer.data},
    ]:[]);
  }));
  return answers.flat();
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

export async function pushMailMigrationQueue(runId:string){
  const {accountId}=env();
  const queueId=process.env.MKETY_MAIL_MIGRATION_QUEUE_ID||'';
  if(!accountId||!queueId) throw new Error('Mkety Mail migration queue is not configured.');
  const payload=await cfFetch(`/accounts/${encodeURIComponent(accountId)}/queues/${encodeURIComponent(queueId)}/messages/batch`,{
    method:'POST',
    body:JSON.stringify({messages:[{body:{runId},content_type:'json'}]}),
  });
  return payload?.result||payload;
}
