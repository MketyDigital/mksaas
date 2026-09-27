export async function fetchMailContent(key:string){
  const url=process.env.MKETY_MAIL_CONTENT_URL||'';
  const secret=process.env.MKETY_MAIL_INTERNAL_SECRET||'';
  if(!url||!secret||!key) return null;
  const response=await fetch(url,{
    method:'POST',
    headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},
    body:JSON.stringify({key}),
    cache:'no-store',
  });
  if(!response.ok) return null;
  return {
    contentType:response.headers.get('content-type')||'application/octet-stream',
    bytes:new Uint8Array(await response.arrayBuffer()),
  };
}

export async function fetchMailText(key:string|null|undefined){
  if(!key) return '';
  const value=await fetchMailContent(key);
  if(!value) return '';
  return new TextDecoder('utf-8',{fatal:false}).decode(value.bytes);
}

export function attachmentManifestKey(rawR2Key:string|null|undefined){
  if(!rawR2Key) return '';
  return rawR2Key.replace(/\/raw\.eml$/,'/attachments.json');
}

export async function fetchAttachmentManifest(rawR2Key:string|null|undefined){
  const key=attachmentManifestKey(rawR2Key);
  if(!key) return [] as Array<{filename:string;contentType:string;r2Key:string;size:number}>;
  const text=await fetchMailText(key);
  if(!text) return [] as Array<{filename:string;contentType:string;r2Key:string;size:number}>;
  try{
    const parsed=JSON.parse(text) as Array<{filename?:string;contentType?:string;r2Key?:string;size?:number}>;
    return parsed.filter((item)=>item.filename&&item.r2Key).map((item)=>({
      filename:String(item.filename),
      contentType:String(item.contentType||'application/octet-stream'),
      r2Key:String(item.r2Key),
      size:Number(item.size||0),
    }));
  }catch{
    return [] as Array<{filename:string;contentType:string;r2Key:string;size:number}>;
  }
}
