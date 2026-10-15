type R2Object={
  body:ReadableStream<Uint8Array>;
  httpMetadata?:{contentType?:string};
  size:number;
  range?:{offset:number;length:number};
};

type Bucket={
  get(key:string,options?:{range:{offset:number;length:number}}):Promise<R2Object|null>;
  put(key:string,value:ReadableStream<Uint8Array>|ArrayBuffer|Uint8Array|string,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;
  delete(key:string):Promise<void>;
};

type Env={
  MAIL_STORAGE:Bucket;
  MKETY_MAIL_INTERNAL_SECRET:string;
};

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const expected=env.MKETY_MAIL_INTERNAL_SECRET||'';
    if(!expected||request.headers.get('authorization')!==`Bearer ${expected}`){
      return new Response('Unauthorized',{status:401});
    }
    if(request.method!=='POST') return new Response('Method not allowed',{status:405});
    const operation=request.headers.get('x-mkety-operation')||'get';

    if(operation==='put'){
      const key=String(request.headers.get('x-mkety-key')||'');
      if(!key.startsWith('mail/')||key.includes('..')) return new Response('Invalid key',{status:400});
      const length=Number(request.headers.get('content-length')||0);
      if(Number.isFinite(length)&&length>25_000_000) return new Response('Payload too large',{status:413});
      if(!request.body) return new Response('Payload required',{status:400});
      let received=0;
      let tooLarge=false;
      const limitedBody=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
        transform(chunk,controller){
          received+=chunk.byteLength;
          if(received>25_000_000){
            tooLarge=true;
            throw new Error('Payload too large');
          }
          controller.enqueue(chunk);
        },
      }));
      try{
        await env.MAIL_STORAGE.put(key,limitedBody,{
          httpMetadata:{contentType:request.headers.get('content-type')||'application/octet-stream'},
        });
      }catch(error){
        await env.MAIL_STORAGE.delete(key).catch(()=>undefined);
        if(tooLarge) return new Response('Payload too large',{status:413});
        throw error;
      }
      if(received<=0||(length>0&&received!==length)){
        await env.MAIL_STORAGE.delete(key);
        return new Response('Invalid payload size',{status:400});
      }
      return Response.json({ok:true,key,size:received});
    }

    if(operation==='delete'){
      const key=String(request.headers.get('x-mkety-key')||'');
      if(!key.startsWith('mail/')||key.includes('..')) return new Response('Invalid key',{status:400});
      await env.MAIL_STORAGE.delete(key);
      return Response.json({ok:true,key});
    }

    const payload=await request.json().catch(()=>null) as {key?:string;range?:{offset?:number;length?:number}}|null;
    const key=String(payload?.key||'');
    if(!key.startsWith('mail/')||key.includes('..')) return new Response('Invalid key',{status:400});
    const range=payload?.range;
    if(range&&(!Number.isSafeInteger(range.offset)||!Number.isSafeInteger(range.length)||Number(range.offset)<0||Number(range.length)<=0||Number(range.length)>25_000_000)){
      return new Response('Invalid range',{status:400});
    }
    const object=await env.MAIL_STORAGE.get(key,range?{range:{offset:Number(range.offset),length:Number(range.length)}}:undefined);
    if(!object) return new Response('Not found',{status:404});
    return new Response(object.body,{
      headers:{
        'content-type':object.httpMetadata?.contentType||'application/octet-stream',
        'content-length':String(object.range?.length??object.size),
        'cache-control':'private, no-store',
      },
    });
  },
};
