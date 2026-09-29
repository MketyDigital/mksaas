'use client';

import { useState } from 'react';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

type SolutionOption = { id: string; name: string; status: string };

export function EnterpriseAiPlaygroundClient({
  tenantSlug,
  solutions,
}: {
  tenantSlug: string;
  solutions: SolutionOption[];
}) {
  const [solutionId,setSolutionId]=useState(solutions[0]?.id??'');
  const [message,setMessage]=useState('');
  const [reply,setReply]=useState('');
  const [requestId,setRequestId]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function runTest(event:React.FormEvent){
    event.preventDefault();
    if(!solutionId||!message.trim()||busy) return;
    setBusy(true);setError('');setReply('');setRequestId('');
    try{
      const response=await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/enterprise-ai/playground`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({solutionId,message}),
      });
      const payload=await response.json().catch(()=>({})) as {ok?:boolean;message?:string;text?:string;requestId?:string};
      if(!response.ok||!payload.ok) throw new Error(payload.message||'The test request failed.');
      setReply(payload.text||'');
      setRequestId(payload.requestId||'');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'The test request failed.');
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Test a solution</CardTitle>
          <CardDescription>
            Uses the real managed model, commercial reservation and solution instructions/knowledge. Test messages consume credits, but pacing and commitment reminders are disabled in playground mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={runTest}>
            <label className="grid gap-2 text-sm font-medium">
              AI solution
              <select className="rounded-xl border bg-background px-3 py-2.5" onChange={(event)=>setSolutionId(event.target.value)} value={solutionId}>
                {solutions.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Test message
              <textarea className="min-h-40 rounded-xl border bg-background px-3 py-3" maxLength={20000} onChange={(event)=>setMessage(event.target.value)} placeholder="Ask the assistant something a real customer might ask…" value={message} />
            </label>
            <Button className="w-fit" disabled={busy||!solutionId||!message.trim()} type="submit">
              {busy?'Testing…':'Run test'}
            </Button>
            {error?<p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>:null}
          </form>
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Assistant response</CardTitle>
          <CardDescription>{requestId?`Request ${requestId}`:'The response appears here after a successful live managed-model test.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-56 whitespace-pre-wrap rounded-xl border bg-muted/20 p-4 text-sm">
            {reply||'No test response yet.'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
