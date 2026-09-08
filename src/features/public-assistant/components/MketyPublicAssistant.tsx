'use client';

import { Bot, History, MessageCircle, Plus, Send, Trash2, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

interface PublicConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface PublicAssistantMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}

interface HistoryResponse {
  conversations: PublicConversationSummary[];
  activeConversationId: string | null;
  messages: PublicAssistantMessage[];
}

const suggestedPrompts = [
  'What can I build with Mkety?',
  'Which Mkety product is right for me?',
  'How does Automation work?',
  'Explain SolutionHub.',
  'How do I get started?',
] as const;

export function MketyPublicAssistant() {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<PublicConversationSummary[]>([]);
  const [messages, setMessages] = useState<PublicAssistantMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async (requestedConversationId?: string) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const query = requestedConversationId
        ? `?conversationId=${encodeURIComponent(requestedConversationId)}`
        : '';
      const response = await fetch(`/api/public/assistant${query}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = (await response.json()) as HistoryResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load Mkety AI history.');
      setConversations(payload.conversations ?? []);
      setConversationId(payload.activeConversationId ?? null);
      setMessages(payload.messages ?? []);
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Could not load Mkety AI history.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadHistory();
  }, [open, loadHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, loading]);

  async function sendMessage(message: string) {
    const normalized = message.trim();
    if (!normalized || loading) return;

    setError(null);
    setLoading(true);
    setInput('');
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: optimisticId, role: 'user', content: normalized },
    ]);

    try {
      const body = conversationId
        ? { message: normalized, conversationId }
        : { message: normalized };
      const response = await fetch('/api/public/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        answer?: string;
        conversationId?: string;
        error?: string;
      };
      if (!response.ok || !payload.answer || !payload.conversationId) {
        throw new Error(payload.error || 'Mkety AI could not answer just now.');
      }
      setConversationId(payload.conversationId);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: payload.answer! },
      ]);
      void loadConversationListOnly(payload.conversationId);
    } catch (sendError) {
      setMessages((current) => current.filter((messageItem) => messageItem.id !== optimisticId));
      setInput(normalized);
      setError(sendError instanceof Error ? sendError.message : 'Mkety AI could not answer just now.');
    } finally {
      setLoading(false);
    }
  }

  async function loadConversationListOnly(activeId: string) {
    try {
      const response = await fetch(`/api/public/assistant?conversationId=${encodeURIComponent(activeId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as HistoryResponse;
      setConversations(payload.conversations ?? []);
    } catch {
      // Conversation persistence succeeded even if this non-critical refresh fails.
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setInput('');
    setError(null);
    setHistoryOpen(false);
  }

  async function clearHistory() {
    if (loading) return;
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/public/assistant', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      });
      if (!response.ok) throw new Error('Could not clear Mkety AI history.');
      setConversations([]);
      startNewChat();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Could not clear Mkety AI history.');
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Ask Mkety AI"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center gap-2 rounded-full border border-violet-400/30 bg-violet-600 px-5 text-sm font-semibold text-white shadow-xl shadow-violet-950/20 transition hover:-translate-y-0.5 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-5 w-5" aria-hidden="true" />}
        <span className="hidden sm:inline">Mkety AI</span>
      </button>

      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Mkety AI"
          className="fixed inset-x-3 bottom-24 z-50 flex max-h-[min(720px,calc(100vh-7rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:left-auto sm:right-5 sm:w-[420px]"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold">Mkety AI</h2>
                <p className="truncate text-xs text-muted-foreground">Ask about Mkety, products, plans and docs</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Conversation history"
                onClick={() => setHistoryOpen((value) => !value)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <History className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="New chat"
                onClick={startNewChat}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Close Mkety AI"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {historyOpen ? (
            <div className="border-b border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent chats</span>
                <button
                  type="button"
                  aria-label="Clear history"
                  disabled={loadingHistory || conversations.length === 0}
                  onClick={() => void clearHistory()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear history
                </button>
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No previous chats yet.</p>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => {
                        setHistoryOpen(false);
                        void loadHistory(conversation.id);
                      }}
                      className={`block w-full truncate rounded-lg px-3 py-2 text-left text-xs hover:bg-muted ${conversation.id === conversationId ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'}`}
                    >
                      {conversation.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {loadingHistory && messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading your Mkety AI conversation…</p>
            ) : null}

            {!loadingHistory && messages.length === 0 ? (
              <div>
                <p className="text-sm leading-6 text-muted-foreground">
                  I can help you understand Mkety, find the right product or workspace, explain plans, and guide you through our public documentation.
                </p>
                <div className="mt-4 grid gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left text-sm transition hover:border-violet-400/50 hover:bg-muted"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${message.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted text-foreground'}`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Mkety AI is thinking…</div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            {error ? (
              <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border bg-background p-3">
            <label htmlFor="mkety-public-ai-message" className="sr-only">Message Mkety AI</label>
            <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 p-2 focus-within:border-violet-400/60">
              <textarea
                id="mkety-public-ai-message"
                aria-label="Message Mkety AI"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                maxLength={2000}
                rows={1}
                placeholder="Ask Mkety AI…"
                className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={loading || !input.trim()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-muted-foreground">
              Mkety AI provides public product and documentation guidance. Avoid sharing passwords, payment details or private account data.
            </p>
          </form>
        </section>
      ) : null}
    </>
  );
}