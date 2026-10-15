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

declare const FixedLengthStream: new(length:number)=>TransformStream<Uint8Array,Uint8Array>;

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
      const rawLength=request.headers.get('content-length');
      const length=rawLength===null?Number.NaN:Number(rawLength);
      if(!Number.isSafeInteger(length)||length<=0) return new Response('Invalid payload size',{status:400});
      if(length>25_000_000) return new Response('Payload too large',{status:413});
      if(!request.body) return new Response('Payload required',{status:400});
      const fixedLengthBody=new FixedLengthStream(length);
      let bodyTransferFailed=false;
      const bodyTransfer=request.body.pipeTo(fixedLengthBody.writable).catch((error)=>{
        bodyTransferFailed=true;
        throw error;
      });
      try{
        await Promise.all([
          env.MAIL_STORAGE.put(key,fixedLengthBody.readable,{
            httpMetadata:{contentType:request.headers.get('content-type')||'application/octet-stream'},
          }),
          bodyTransfer,
        ]);
      }catch(error){
        await env.MAIL_STORAGE.delete(key).catch(()=>undefined);
        if(bodyTransferFailed) return new Response('Invalid payload size',{status:400});
        const errorCode=error instanceof Error?(/\((\d{5})\)\s*$/.exec(error.message)?.[1]||'unknown'): 'unknown';
        console.error('[mail-content] R2 object write failed',{
          stage:'put_r2',
          errorName:error instanceof Error?error.name:'unknown',
          errorCode,
        });
        throw error;
      }
      return Response.json({ok:true,key,size:length});
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
