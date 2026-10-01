import { Headphones, MessageSquareMore } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  listEnterpriseAiConversationMessages,
  listEnterpriseAiConversations,
  resumeEnterpriseAiConversation,
  sendEnterpriseAiHumanReply,
  takeOverEnterpriseAiConversation,
} from '@/features/ai-runtime/channels/server/conversation-actions';
import { hasEnterpriseAiAccess } from '@/features/ai-runtime/server/access';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@/shared/components/ui';
import { requirePermission } from '@/shared/lib/permissions';
import { getTenantBySlug } from '@/shared/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function EnterpriseAiConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ conversation?: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const { conversation: selectedId } = await searchParams;
  await requirePermission(tenantSlug, 'ai:channels:manage');
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect('/select-tenant');
  if (!(await hasEnterpriseAiAccess(tenant.id))) redirect(`/app/${tenantSlug}/enterprise-ai`);

  const conversations = await listEnterpriseAiConversations(tenant.id);
  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0] ?? null;
  const messages = selected
    ? await listEnterpriseAiConversationMessages(tenant.id, selected.id)
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 py-4">
      <div>
        <Link className="text-sm text-muted-foreground" href={`/app/${tenantSlug}/enterprise-ai`}>← Enterprise AI</Link>
        <div className="mt-2 flex items-center gap-3">
          <Headphones className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Conversations & human handoff</h1>
        </div>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Review customer conversations, take over one conversation without pausing the rest of your AI, reply as an operator, and return it to automation when ready.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Recent conversations</CardTitle>
            <CardDescription>{conversations.length} loaded</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {conversations.length ? conversations.map((item) => (
              <Link
                className={`rounded-xl border p-3 text-sm transition hover:border-primary/40 ${selected?.id === item.id ? 'border-primary bg-primary/5' : ''}`}
                href={`/app/${tenantSlug}/enterprise-ai/conversations?conversation=${item.id}`}
                key={item.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate">{item.externalUserId ?? item.externalConversationId}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${item.status === 'human' ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                    {item.status === 'human' ? 'Human' : 'AI'}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.solutionName ?? 'Enterprise AI'} · {item.providerKey?.replace('channel:', '') ?? 'channel'}</p>
              </Link>
            )) : (
              <p className="text-sm text-muted-foreground">No customer conversations yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          {selected ? (
            <>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selected.externalUserId ?? selected.externalConversationId}</CardTitle>
                    <CardDescription>{selected.solutionName ?? 'Enterprise AI'} · {selected.providerKey?.replace('channel:', '') ?? 'channel'}</CardDescription>
                  </div>
                  <span className="rounded-full border px-3 py-1 text-xs font-semibold">
                    {selected.status === 'human' ? 'Human operator active' : 'AI automation active'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-4">
                  {messages.map((message) => (
                    <div className={`max-w-[85%] rounded-xl p-3 text-sm ${message.direction === 'inbound' ? 'bg-background' : 'ml-auto bg-primary/10'}`} key={message.id}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">{message.direction === 'inbound' ? 'Customer' : message.metadata?.humanOperator ? 'Human operator' : 'AI'} · {message.createdAt.toLocaleString()}</p>
                    </div>
                  ))}
                  {!messages.length ? <p className="text-sm text-muted-foreground">No persisted messages yet.</p> : null}
                </div>

                {selected.status === 'human' ? (
                  <div className="space-y-3">
                    <form action={sendEnterpriseAiHumanReply.bind(null, tenantSlug, selected.id)} className="flex gap-2">
                      <Input maxLength={20000} name="message" placeholder="Reply as a human operator…" required />
                      <Button type="submit">Send</Button>
                    </form>
                    <form action={resumeEnterpriseAiConversation.bind(null, tenantSlug, selected.id)}>
                      <Button type="submit" variant="outline">Resume AI for this conversation</Button>
                    </form>
                  </div>
                ) : (
                  <form action={takeOverEnterpriseAiConversation.bind(null, tenantSlug, selected.id)} className="space-y-3 rounded-xl border p-4">
                    <div className="flex items-center gap-2 font-semibold"><MessageSquareMore className="h-4 w-4" /> Take over this conversation</div>
                    <Input maxLength={1000} name="reason" placeholder="Optional internal reason" />
                    <Button type="submit">Take over</Button>
                    <p className="text-xs text-muted-foreground">Pending automated replies and reminders for this conversation are cancelled when you take over.</p>
                  </form>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="py-12 text-center text-muted-foreground">Select a conversation after your first customer message arrives.</CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
