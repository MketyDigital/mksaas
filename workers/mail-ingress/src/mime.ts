export type ParsedAttachment={
  filename:string;
  contentType:string;
  bytes:Uint8Array;
};

export type ParsedMail={
  text:string;
  html:string;
  attachments:ParsedAttachment[];
};

function parseHeaders(raw:string){
  const result:Record<string,string>={};
  const unfolded=raw.replace(/\r?\n[ \t]+/g,' ');
  for(const line of unfolded.split(/\r?\n/)){
    const index=line.indexOf(':');
    if(index<=0) continue;
    result[line.slice(0,index).trim().toLowerCase()]=line.slice(index+1).trim();
  }
  return result;
}

function parameter(value:string|undefined,name:string){
  if(!value) return '';
  const match=value.match(new RegExp('(?:^|;)\\s*'+name+'\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))','i'));
  return (match?.[1]||match?.[2]||'').trim();
}

function quotedPrintable(value:string){
  const normalized=value.replace(/=\r?\n/g,'');
  const bytes:number[]=[];
  for(let i=0;i<normalized.length;i++){
    if(normalized[i]==='='&&/^[0-9A-Fa-f]{2}$/.test(normalized.slice(i+1,i+3))){
      bytes.push(Number.parseInt(normalized.slice(i+1,i+3),16));
      i+=2;
    }else{
      const encoded=new TextEncoder().encode(normalized[i]);
      bytes.push(...encoded);
    }
  }
  return new Uint8Array(bytes);
}

function base64Bytes(value:string){
  const binary=atob(value.replace(/\s+/g,''));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}

function decodeBytes(body:string,encoding:string){
  const normalized=encoding.toLowerCase();
  if(normalized==='base64') return base64Bytes(body);
  if(normalized==='quoted-printable') return quotedPrintable(body);
  return new TextEncoder().encode(body);
}

function safeText(bytes:Uint8Array){
  try{return new TextDecoder('utf-8',{fatal:false}).decode(bytes);}catch{return '';}
}

function cleanFilename(value:string){
  const normalized=value.replace(/[\\/\0]/g,'_').replace(/[^\p{L}\p{N}._()\- ]/gu,'_').trim();
  return normalized.slice(0,180)||'attachment';
}

function splitMultipart(body:string,boundary:string){
  const marker='--'+boundary;
  return body.split(marker).slice(1).map((part)=>part.replace(/^\r?\n/,'').replace(/\r?\n--\s*$/,'').trim()).filter(Boolean);
}

function parsePart(raw:string,result:ParsedMail){
  const split=raw.search(/\r?\n\r?\n/);
  const headerText=split>=0?raw.slice(0,split):'';
  const body=split>=0?raw.slice(split).replace(/^\r?\n\r?\n/,''):raw;
  const headers=parseHeaders(headerText);
  const contentType=headers['content-type']||'text/plain';
  const mediaType=contentType.split(';')[0].trim().toLowerCase();
  const disposition=headers['content-disposition']||'';
  const boundary=parameter(contentType,'boundary');

  if(mediaType.startsWith('multipart/')&&boundary){
    for(const child of splitMultipart(body,boundary)) parsePart(child,result);
    return;
  }

  const encoding=headers['content-transfer-encoding']||'';
  let bytes:Uint8Array;
  try{bytes=decodeBytes(body,encoding);}catch{bytes=new TextEncoder().encode(body);}

  const filename=parameter(disposition,'filename')||parameter(contentType,'name');
  const isAttachment=/attachment/i.test(disposition)||Boolean(filename);
  if(isAttachment){
    result.attachments.push({
      filename:cleanFilename(filename||'attachment'),
      contentType:mediaType||'application/octet-stream',
      bytes,
    });
    return;
  }

  const value=safeText(bytes).trim();
  if(!value) return;
  if(mediaType==='text/html'){
    if(!result.html) result.html=value;
  }else if(mediaType==='text/plain'){
    if(!result.text) result.text=value;
  }
}

export function parseMime(bytes:Uint8Array):ParsedMail{
  const raw=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  const result:ParsedMail={text:'',html:'',attachments:[]};
  parsePart(raw,result);
  return result;
}
