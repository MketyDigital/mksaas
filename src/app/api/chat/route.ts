import {
  createIdGenerator,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from 'ai';
import { and, eq } from 'drizzle-orm';

import { classifyManagedAiTask } from '@/features/ai-runtime/managed-model-policy';
import { runCentralAi } from '@/features/ai-runtime/providers/central-runtime';
import { db } from '@/shared/db';
import { assistantConversations, persons, tenantMemberships, tenants } from '@/shared/db/schema';
import { auth } from '@/shared/lib/auth';
import { env } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger';
import { AuditActions, logAuditEvent } from '@/shared/services/audit-service';

export const maxDuration = 30;

function deriveConversationTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New Conversation';
  const parts = first.parts as Array<{ type: string; text?: string }> | undefined;
  const text = parts?.map((p) => (p.type === 'text' ? p.text : '')).join(' ') || 'New Conversation';
  return text.slice(0, 60) + (text.length > 60 ? '...' : '');
}

function toCentralMessages(messages: UIMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      const parts = message.parts as Array<{ type: string; text?: string }> | undefined;
      return {
        role: message.role as 'user' | 'assistant',
        content: parts?.map((part) => (part.type === 'text' ? part.text ?? '' : '')).join('\n').trim() ?? '',
      };
    })
    .filter((message) => message.content);
}

export async function POST(req: Request) {
  if (!env.ENABLE_AI_FEATURES) {
    return new Response('AI features are disabled until ENABLE_AI_FEATURES=true.', { status: 503 });
  }

  const body = await req.json();
  const {
    messages,
    tenantSlug,
    conversationId = `conv_${Date.now()}`,
    providerConnectionId,
    model,
    taskClass,
  } = body as {
    messages: UIMessage[];
    tenantSlug: string;
    conversationId?: string;
    providerConnectionId?: string | null;
    model?: string | null;
    taskClass?: 'economy' | 'smart' | 'heavy';
  };

  const session = await auth();
  if (!session?.user?.id || !session.user.email) return new Response('Unauthorized', { status: 401 });

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
  if (!tenant) return new Response('Tenant not found', { status: 404 });

  const membership = await db.query.tenantMemberships.findFirst({
    where: and(eq(tenantMemberships.tenantId, tenant.id), eq(tenantMemberships.userId, session.user.id)),
  });
  if (!membership) return new Response('Forbidden', { status: 403 });

  const person = await db.query.persons.findFirst({
    where: and(eq(persons.tenantId, tenant.id), eq(persons.email, session.user.email)),
  });
  if (!person) return new Response('Workspace profile not found', { status: 409 });

  const centralMessages = toCentralMessages(messages);
  if (!centralMessages.length) return new Response('At least one message is required.', { status: 400 });

  const systemPrompt = `You are the Mkety AI assistant for ${tenant.name}.
You help users with their questions and tasks across the Mkety platform.
Be helpful, concise, and professional.
Do not claim to have performed actions you did not perform.
Current user: ${session.user.name || session.user.email}`;

  const parts = messages.at(-1)?.parts as Array<{ type: string; text?: string }> | undefined;
  const messagePreview = parts?.map((p) => (p.type === 'text' ? p.text : '')).join(' ').slice(0, 100) || '';

  const resolvedTaskClass = classifyManagedAiTask({
    messages: centralMessages,
    requested: taskClass ?? null,
  });

  const response = await runCentralAi({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    messages: centralMessages,
    system: systemPrompt,
    taskClass: resolvedTaskClass,
    providerConnectionId: providerConnectionId ?? null,
    model: model ?? null,
    maxOutputTokens: 2_000,
  }).catch((error) => {
    logger.error({ error }, 'Central Mkety AI execution failed');
    return null;
  });

  if (!response?.text) {
    return new Response('AI provider is not configured or did not return a usable response.', { status: 503 });
  }

  logAuditEvent({
    tenantId: tenant.id,
    actorId: person.id,
    action: AuditActions.AI_CONVERSATION,
    entityType: 'ai_assistant',
    metadata: {
      messagePreview,
      messageCount: messages.length,
      provider: response.provider,
      model: response.nativeModel,
      source: response.source,
    },
    aiModelVersion: response.nativeModel,
  }).catch((err) => logger.error({ error: err }, 'Failed to log AI conversation'));

  const generateMessageId = createIdGenerator({ prefix: 'msg', size: 16 });
  const stream = createUIMessageStream({
    originalMessages: messages,
    generateId: generateMessageId,
    execute: ({ writer }) => {
      const messageId = generateMessageId();
      const textId = `text_${messageId}`;
      writer.write({ type: 'start', messageId });
      writer.write({ type: 'text-start', id: textId });
      writer.write({ type: 'text-delta', id: textId, delta: response.text });
      writer.write({ type: 'text-end', id: textId });
    },
    onFinish: async ({ messages: finishedMessages }) => {
      const title = deriveConversationTitle(finishedMessages as UIMessage[]);
      await db.insert(assistantConversations).values({
        id: conversationId,
        tenantId: tenant.id,
        personId: person.id,
        title,
        messages: finishedMessages as unknown[],
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: assistantConversations.id,
        set: { title, messages: finishedMessages as unknown[], updatedAt: new Date() },
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
