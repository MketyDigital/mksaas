'use client';

import { FormEvent, useState } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function AgentPlayground({
  agentId,
  tenantSlug,
  projectSlug,
}: {
  agentId: string;
  tenantSlug: string;
  projectSlug: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || running) return;

    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setRunning(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, projectSlug, messages: nextMessages }),
      });

      if (!response.ok) throw new Error((await response.text()) || 'Agent request failed.');
      if (!response.body) throw new Error('The agent returned no response stream.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      setMessages((current) => [...current, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        const snapshot = assistantContent;
        setMessages((current) => {
          const copy = [...current];
          copy[copy.length - 1] = { role: 'assistant', content: snapshot };
          return copy;
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Agent request failed.');
      setMessages(nextMessages);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6">
      <div className="mb-4">
        <h2 className="font-medium">AI Test Playground</h2>
        <p className="mt-1 text-sm text-muted-foreground">Test this agent using the same runtime that will power its future published endpoints.</p>
      </div>

      <div className="min-h-64 space-y-4 rounded-lg border bg-background p-4">
        {messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Send a message to test your agent.</p>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-8' : 'mr-8'}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{message.role}</p>
              <div className="whitespace-pre-wrap rounded-lg border px-3 py-2 text-sm">{message.content || (running && index === messages.length - 1 ? 'Thinking…' : '')}</div>
            </div>
          ))
        )}
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={running}
          placeholder="Message your agent…"
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button disabled={running || !input.trim()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {running ? 'Running…' : 'Send'}
        </button>
      </form>
    </section>
  );
}
