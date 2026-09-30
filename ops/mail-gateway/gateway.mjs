import { createHash } from 'node:crypto';
import http from 'node:http';
import tls from 'node:tls';

const API_BASE=(process.env.MKETY_MAIL_GATEWAY_API_BASE_URL||'https://api.mkety.com').replace(/\/$/,'');
const SECRET=process.env.MKETY_MAIL_GATEWAY_INTERNAL_SECRET||'';
const CERT_B64=process.env.MKETY_MAIL_GATEWAY_TLS_CERT_B64||'';
const KEY_B64=process.env.MKETY_MAIL_GATEWAY_TLS_KEY_B64||'';

if(!SECRET||!CERT_B64||!KEY_B64){
  console.error('MKETY_MAIL_GATEWAY_CONFIG_OK=false');
  process.exit(1);
}

const cert=Buffer.from(CERT_B64,'base64').toString('utf8');
const key=Buffer.from(KEY_B64,'base64').toString('utf8');
const tlsOptions={cert,key,minVersion:'TLSv1.2',honorCipherOrder:true};

async function jsonApi(path,body){
  const response=await fetch(API_BASE+path,{
    method:'POST',
    headers:{authorization:`Bearer ${SECRET}`,'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(20000),
  });
  const payload=await response.json().catch(()=>({ok:false,error:'invalid_gateway_response'}));
  return {response,payload};
}

async function rawApi(path,body){
  const response=await fetch(API_BASE+path,{
    method:'POST',
    headers:{authorization:`Bearer ${SECRET}`,'content-type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(20000),
  });
  if(!response.ok) return {response,bytes:null};
  return {response,bytes:Buffer.from(await response.arrayBuffer())};
}

function uidValidity(mailboxId){
  const value=createHash('sha256').update(mailboxId).digest().readUInt32BE(0)&0x7fffffff;
  return value||1;
}

function quote(value){
  return '"'+String(value??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n]+/g,' ')+'"';
}

function flags(message){
  const result=[];
  if(message.isRead) result.push('\\Seen');
  if(message.isStarred) result.push('\\Flagged');
  return result;
}

async function listAll(session,folder){
  const messages=[];
  let afterUid=0;
  for(let page=0;page<20;page+=1){
    const {response,payload}=await jsonApi('/api/internal/mail/gateway/messages',{
      tenantId:session.tenantId,mailboxId:session.mailboxId,folder,afterUid,limit:500,
    });
    if(!response.ok||payload.ok!==true){
      const detail=String(payload?.detail||payload?.error||`http_${response.status}`).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,80)||'unknown';
      throw new Error(`message_index_failed:${detail}`);
    }
    const rows=Array.isArray(payload.messages)?payload.messages:[];
    messages.push(...rows);
    if(rows.length<500) break;
    afterUid=Number(rows.at(-1)?.uid||afterUid);
  }
  return messages;
}

function parseSet(spec,messages,useUid){
  const values=new Set();
  const source=useUid?messages.map(m=>Number(m.uid)):messages.map((_,i)=>i+1);
  const max=source.at(-1)||0;
  for(const part of String(spec||'').split(',')){
    if(!part) continue;
    if(part.includes(':')){
      const [aRaw,bRaw]=part.split(':',2);
      const a=aRaw==='*'?max:Number(aRaw);
      const b=bRaw==='*'?max:Number(bRaw);
      if(!Number.isFinite(a)||!Number.isFinite(b)) continue;
      const lo=Math.min(a,b),hi=Math.max(a,b);
      for(const value of source) if(value>=lo&&value<=hi) values.add(value);
    }else{
      const value=part==='*'?max:Number(part);
      if(Number.isFinite(value)) values.add(value);
    }
  }
  return values;
}

function envelope(message){
  const date=new Date(message.internalDate||Date.now()).toUTCString();
  const sender=String(message.from||'');
  const [local,domain='']=sender.split('@');
  const to=(Array.isArray(message.to)?message.to:[]).map((addr)=>{
    const [l,d='']=String(addr).split('@');
    return `(NIL NIL ${quote(l)} ${quote(d)})`;
  }).join(' ');
  return `(${quote(date)} ${quote(message.subject||'')} ((NIL NIL ${quote(local)} ${quote(domain)})) ((NIL NIL ${quote(local)} ${quote(domain)})) ((NIL NIL ${quote(local)} ${quote(domain)})) ${to?`(${to})`:'NIL'} NIL NIL NIL NIL)`;
}

function parseCommand(line){
  const first=line.indexOf(' ');
  if(first<0) return {tag:line,command:'',args:''};
  const tag=line.slice(0,first);
  const rest=line.slice(first+1).trim();
  const second=rest.indexOf(' ');
  return second<0
    ? {tag,command:rest.toUpperCase(),args:''}
    : {tag,command:rest.slice(0,second).toUpperCase(),args:rest.slice(second+1)};
}

function parseLoginArgs(args){
  const parts=[];
  const re=/"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let match;
  while((match=re.exec(args))) parts.push((match[1]??match[2]??'').replace(/\\(["\\])/g,'$1'));
  return parts;
}

async function authenticate(username,password){
  const {response,payload}=await jsonApi('/api/internal/mail/gateway/auth',{username,password});
  if(!response.ok||payload.ok!==true) return null;
  return payload;
}

function startImap(){
  const server=tls.createServer(tlsOptions,(socket)=>{
    socket.setTimeout(10*60*1000);
    socket.write('* OK [CAPABILITY IMAP4rev1 UIDPLUS NAMESPACE IDLE AUTH=PLAIN] Mkety Mail ready\r\n');
    let buffer='';
    let session=null;
    let selected='inbox';
    let authPlainPending=null;

    const send=(line)=>socket.write(line+'\r\n');
    const tagged=(tag,status,text)=>send(`${tag} ${status} ${text}`);

    socket.on('data',async(chunk)=>{
      buffer+=chunk.toString('utf8');
      while(buffer.includes('\n')){
        const idx=buffer.indexOf('\n');
        const line=buffer.slice(0,idx).replace(/\r$/,'');
        buffer=buffer.slice(idx+1);
        try{
          if(authPlainPending){
            const tag=authPlainPending;authPlainPending=null;
            const decoded=Buffer.from(line.trim(),'base64').toString('utf8').split('\0');
            const username=decoded.at(-2)||'',password=decoded.at(-1)||'';
            session=await authenticate(username,password);
            tagged(tag,session?'OK':'NO',session?'AUTHENTICATE completed':'Authentication failed');
            continue;
          }

          const {tag,command,args}=parseCommand(line);
          if(!tag||!command) continue;

          if(command==='CAPABILITY'){
            send('* CAPABILITY IMAP4rev1 UIDPLUS NAMESPACE IDLE AUTH=PLAIN');
            tagged(tag,'OK','CAPABILITY completed');
          }else if(command==='NOOP'){
            tagged(tag,'OK','NOOP completed');
          }else if(command==='ID'){
            send('* ID ("name" "Mkety Mail" "vendor" "Mkety")');
            tagged(tag,'OK','ID completed');
          }else if(command==='NAMESPACE'){
            send('* NAMESPACE (("" "/")) NIL NIL');
            tagged(tag,'OK','NAMESPACE completed');
          }else if(command==='LOGIN'){
            const [username,password]=parseLoginArgs(args);
            session=await authenticate(username||'',password||'');
            tagged(tag,session?'OK':'NO',session?'LOGIN completed':'Authentication failed');
          }else if(command==='AUTHENTICATE'&&args.toUpperCase().startsWith('PLAIN')){
            const initial=args.slice(5).trim();
            if(initial){
              const decoded=Buffer.from(initial,'base64').toString('utf8').split('\0');
              session=await authenticate(decoded.at(-2)||'',decoded.at(-1)||'');
              tagged(tag,session?'OK':'NO',session?'AUTHENTICATE completed':'Authentication failed');
            }else{
              authPlainPending=tag;send('+');
            }
          }else if(command==='LOGOUT'){
            send('* BYE Mkety Mail logging out');tagged(tag,'OK','LOGOUT completed');socket.end();
          }else if(!session){
            tagged(tag,'NO','Authenticate first');
          }else if(command==='LIST'||command==='LSUB'){
            send('* LIST (\\HasNoChildren) "/" "INBOX"');
            send('* LIST (\\HasNoChildren \\Sent) "/" "Sent"');
            tagged(tag,'OK',`${command} completed`);
          }else if(command==='SELECT'||command==='EXAMINE'){
            const name=args.replace(/^"|"$/g,'').toLowerCase();
            selected=name==='sent'?'sent':'inbox';
            const messages=await listAll(session,selected);
            const unseen=messages.filter(m=>!m.isRead).length;
            const next=(messages.at(-1)?.uid||0)+1;
            send('* FLAGS (\\Seen \\Flagged)');
            send(`* ${messages.length} EXISTS`);
            send('* 0 RECENT');
            send(`* OK [UNSEEN ${unseen?messages.findIndex(m=>!m.isRead)+1:0}]`);
            send(`* OK [UIDVALIDITY ${uidValidity(session.mailboxId)}]`);
            send(`* OK [UIDNEXT ${next}]`);
            tagged(tag,'OK',`[READ-${command==='EXAMINE'?'ONLY':'WRITE'}] ${command} completed`);
          }else if(command==='STATUS'){
            const messages=await listAll(session,args.toLowerCase().includes('sent')?'sent':'inbox');
            const unseen=messages.filter(m=>!m.isRead).length;
            const next=(messages.at(-1)?.uid||0)+1;
            send(`* STATUS ${args.split(' ')[0]} (MESSAGES ${messages.length} UNSEEN ${unseen} UIDNEXT ${next} UIDVALIDITY ${uidValidity(session.mailboxId)})`);
            tagged(tag,'OK','STATUS completed');
          }else if(command==='SEARCH'||(command==='UID'&&args.toUpperCase().startsWith('SEARCH'))){
            const useUid=command==='UID';
            const messages=await listAll(session,selected);
            const criteria=useUid?args.slice(6).trim().toUpperCase():args.toUpperCase();
            const filtered=criteria.includes('UNSEEN')?messages.filter(m=>!m.isRead):messages;
            send('* SEARCH '+filtered.map((m,i)=>useUid?m.uid:messages.indexOf(m)+1).join(' '));
            tagged(tag,'OK','SEARCH completed');
          }else if(command==='FETCH'||(command==='UID'&&args.toUpperCase().startsWith('FETCH'))){
            const useUid=command==='UID';
            const fetchArgs=useUid?args.slice(5).trim():args;
            const space=fetchArgs.indexOf(' ');
            const setSpec=space<0?fetchArgs:fetchArgs.slice(0,space);
            const items=(space<0?'':fetchArgs.slice(space+1)).toUpperCase();
            const messages=await listAll(session,selected);
            const wanted=parseSet(setSpec,messages,useUid);
            for(let i=0;i<messages.length;i+=1){
              const message=messages[i];
              const keyValue=useUid?Number(message.uid):i+1;
              if(!wanted.has(keyValue)) continue;
              const base=[`UID ${message.uid}`,`FLAGS (${flags(message).join(' ')})`,`INTERNALDATE ${quote(new Date(message.internalDate).toUTCString())}`];
              if(items.includes('ENVELOPE')) base.push(`ENVELOPE ${envelope(message)}`);
              const needsBody=/BODY|RFC822/i.test(items);
              if(needsBody){
                const {response,bytes}=await rawApi('/api/internal/mail/gateway/message',{
                  tenantId:session.tenantId,mailboxId:session.mailboxId,uid:message.uid,
                });
                if(!response.ok||!bytes) continue;
                let payload=bytes;
                let label='BODY[]';
                if(items.includes('HEADER')){
                  const marker=bytes.indexOf(Buffer.from('\r\n\r\n'));
                  payload=marker>=0?bytes.subarray(0,marker+4):bytes;
                  label='BODY[HEADER]';
                }else if(items.includes('RFC822')) label='RFC822';
                base.push(`RFC822.SIZE ${bytes.length}`);
                socket.write(`* ${i+1} FETCH (${base.join(' ')} ${label} {${payload.length}}\r\n`);
                socket.write(payload);socket.write('\r\n)\r\n');
              }else{
                send(`* ${i+1} FETCH (${base.join(' ')})`);
              }
            }
            tagged(tag,'OK','FETCH completed');
          }else if(command==='STORE'||(command==='UID'&&args.toUpperCase().startsWith('STORE'))){
            const useUid=command==='UID';
            const storeArgs=useUid?args.slice(5).trim():args;
            const parts=storeArgs.split(/\s+/,3);
            const messages=await listAll(session,selected);
            const wanted=parseSet(parts[0],messages,useUid);
            const flagText=storeArgs.slice(storeArgs.indexOf(parts[1])+parts[1].length).toUpperCase();
            const add=parts[1].startsWith('+'),remove=parts[1].startsWith('-');
            for(let i=0;i<messages.length;i+=1){
              const message=messages[i],keyValue=useUid?Number(message.uid):i+1;
              if(!wanted.has(keyValue)) continue;
              const nextRead=flagText.includes('\\SEEN')?(remove?false:true):message.isRead;
              const nextStar=flagText.includes('\\FLAGGED')?(remove?false:true):message.isStarred;
              await jsonApi('/api/internal/mail/gateway/flags',{
                tenantId:session.tenantId,mailboxId:session.mailboxId,uid:message.uid,isRead:nextRead,isStarred:nextStar,
              });
              if(!parts[1].toUpperCase().includes('.SILENT')){
                send(`* ${i+1} FETCH (UID ${message.uid} FLAGS (${flags({...message,isRead:nextRead,isStarred:nextStar}).join(' ')}))`);
              }
            }
            tagged(tag,'OK','STORE completed');
          }else if(command==='CLOSE'||command==='CHECK'){
            tagged(tag,'OK',`${command} completed`);
          }else if(command==='IDLE'){
            send('+ idling');
          }else if(command==='DONE'){
            tagged(tag,'OK','IDLE terminated');
          }else{
            tagged(tag,'BAD','Unsupported command');
          }
        }catch(error){
          console.error('MKETY_MAIL_GATEWAY_IMAP_ERROR='+String(error?.message||error));
          const tag=line.split(' ',1)[0]||'*';
          tagged(tag,'NO','Temporary server error');
        }
      }
    });
    socket.on('timeout',()=>socket.end());
    socket.on('error',()=>{});
  });
  server.on('tlsClientError',()=>{});
  server.listen(993,'0.0.0.0',()=>console.log('MKETY_MAIL_GATEWAY_IMAP_READY=true'));
}

function startSmtp(){
  const server=tls.createServer(tlsOptions,(socket)=>{
    socket.setTimeout(10*60*1000);
    socket.write('220 smtp.mkety.com ESMTP Mkety Mail\r\n');
    let buffer='',session=null,mailFrom='',recipients=[],dataMode=false,dataLines=[],authLoginStage='',authLoginUser='';

    const send=(line)=>socket.write(line+'\r\n');
    const reset=()=>{mailFrom='';recipients=[];dataMode=false;dataLines=[];};

    socket.on('data',async(chunk)=>{
      buffer+=chunk.toString('utf8');
      while(buffer.includes('\n')){
        const idx=buffer.indexOf('\n');
        let line=buffer.slice(0,idx).replace(/\r$/,'');
        buffer=buffer.slice(idx+1);
        try{
          if(dataMode){
            if(line==='.'){
              dataMode=false;
              const raw=Buffer.from(dataLines.map(v=>v.startsWith('..')?v.slice(1):v).join('\r\n')+'\r\n','utf8');
              if(raw.length>25_000_000){send('552 5.3.4 Message too large');reset();continue;}
              const {response,payload}=await jsonApi('/api/internal/mail/gateway/submit',{
                tenantId:session.tenantId,mailboxId:session.mailboxId,from:mailFrom,recipients,
                rawBase64:raw.toString('base64'),
              });
              if(response.ok&&payload.ok===true) send('250 2.0.0 Message accepted for delivery');
              else if(response.status===429) send('452 4.2.2 Sending limit reached');
              else if(response.status===409) send('550 5.7.1 Sender or recipient policy rejected');
              else send('451 4.3.0 Temporary server error');
              reset();
            }else{
              dataLines.push(line);
              if(dataLines.reduce((n,v)=>n+v.length+2,0)>25_000_000){send('552 5.3.4 Message too large');reset();}
            }
            continue;
          }

          if(authLoginStage==='username'){
            authLoginUser=Buffer.from(line.trim(),'base64').toString('utf8');authLoginStage='password';send('334 UGFzc3dvcmQ6');continue;
          }
          if(authLoginStage==='password'){
            const password=Buffer.from(line.trim(),'base64').toString('utf8');authLoginStage='';
            session=await authenticate(authLoginUser,password);
            send(session?'235 2.7.0 Authentication successful':'535 5.7.8 Authentication credentials invalid');
            continue;
          }

          const [verbRaw,...restParts]=line.split(' ');
          const verb=String(verbRaw||'').toUpperCase(),rest=restParts.join(' ').trim();
          if(verb==='EHLO'||verb==='HELO'){
            send('250-smtp.mkety.com');send('250-SIZE 25000000');send('250-8BITMIME');send('250-AUTH PLAIN LOGIN');send('250 PIPELINING');
          }else if(verb==='NOOP'){send('250 2.0.0 OK');
          }else if(verb==='RSET'){reset();send('250 2.0.0 Reset');
          }else if(verb==='QUIT'){send('221 2.0.0 Bye');socket.end();
          }else if(verb==='AUTH'){
            const [method,initial]=rest.split(/\s+/,2);
            if(String(method).toUpperCase()==='PLAIN'){
              if(!initial){send('334 ');authLoginStage='plain';}
              else{
                const decoded=Buffer.from(initial,'base64').toString('utf8').split('\0');
                session=await authenticate(decoded.at(-2)||'',decoded.at(-1)||'');
                send(session?'235 2.7.0 Authentication successful':'535 5.7.8 Authentication credentials invalid');
              }
            }else if(String(method).toUpperCase()==='LOGIN'){
              authLoginStage='username';send('334 VXNlcm5hbWU6');
            }else send('504 5.5.4 Unsupported authentication mechanism');
          }else if(authLoginStage==='plain'){
            authLoginStage='';
            const decoded=Buffer.from(line.trim(),'base64').toString('utf8').split('\0');
            session=await authenticate(decoded.at(-2)||'',decoded.at(-1)||'');
            send(session?'235 2.7.0 Authentication successful':'535 5.7.8 Authentication credentials invalid');
          }else if(!session){send('530 5.7.0 Authentication required');
          }else if(verb==='MAIL'){
            const match=rest.match(/^FROM:\s*<([^>]+)>/i);
            const from=String(match?.[1]||'').toLowerCase();
            if(from!==String(session.address).toLowerCase()) send('553 5.7.1 Envelope sender must match authenticated mailbox');
            else{mailFrom=from;recipients=[];send('250 2.1.0 Sender OK');}
          }else if(verb==='RCPT'){
            const match=rest.match(/^TO:\s*<([^>]+)>/i);
            const to=String(match?.[1]||'').trim().toLowerCase();
            if(!mailFrom) send('503 5.5.1 Need MAIL FROM first');
            else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||recipients.length>=50) send('550 5.1.3 Invalid recipient');
            else{recipients.push(to);send('250 2.1.5 Recipient OK');}
          }else if(verb==='DATA'){
            if(!mailFrom||!recipients.length) send('503 5.5.1 Need MAIL FROM and RCPT TO first');
            else{dataMode=true;dataLines=[];send('354 End data with <CR><LF>.<CR><LF>');}
          }else send('502 5.5.2 Command not implemented');
        }catch(error){
          console.error('MKETY_MAIL_GATEWAY_SMTP_ERROR='+String(error?.message||error));
          send('451 4.3.0 Temporary server error');
          reset();
        }
      }
    });
    socket.on('timeout',()=>socket.end());
    socket.on('error',()=>{});
  });
  server.on('tlsClientError',()=>{});
  server.listen(465,'0.0.0.0',()=>console.log('MKETY_MAIL_GATEWAY_SMTP_READY=true'));
}

http.createServer((_req,res)=>{
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({ok:true,service:'mkety-mail-gateway'}));
}).listen(8080,'0.0.0.0',()=>console.log('MKETY_MAIL_GATEWAY_HEALTH_READY=true'));

startImap();
startSmtp();
console.log('MKETY_MAIL_GATEWAY_CONFIG_OK=true');
