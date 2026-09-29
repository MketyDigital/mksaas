type R2Object={
  body:ReadableStream<Uint8Array>;
  httpMetadata?:{contentType?:string};
  size:number;
};

type Bucket={
  get(key:string):Promise<R2Object|null>;
  put(key:string,value:ArrayBuffer|Uint8Array|string,options?:{httpMetadata?:{contentType?:string}}):Promise<unknown>;
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
      const bytes=await request.arrayBuffer();
      if(bytes.byteLength<=0||bytes.byteLength>25_000_000) return new Response('Payload too large',{status:413});
      await env.MAIL_STORAGE.put(key,bytes,{
        httpMetadata:{contentType:request.headers.get('content-type')||'application/octet-stream'},
      });
      return Response.json({ok:true,key,size:bytes.byteLength});
    }

    const payload=await request.json().catch(()=>null) as {key?:string}|null;
    const key=String(payload?.key||'');
    if(!key.startsWith('mail/')||key.includes('..')) return new Response('Invalid key',{status:400});
    const object=await env.MAIL_STORAGE.get(key);
    if(!object) return new Response('Not found',{status:404});
    return new Response(object.body,{
      headers:{
        'content-type':object.httpMetadata?.contentType||'application/octet-stream',
        'content-length':String(object.size),
        'cache-control':'private, no-store',
      },
    });
  },
};
