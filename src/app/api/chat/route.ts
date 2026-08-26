import { convertToModelMessages, createIdGenerator, stepCountIs, streamText, type UIMessage } from 'ai';
import { and, eq } from 'drizzle-orm';

import { getAIModel, getAIProvider } from '@/features/ai/lib/provider';
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

export async function POST(req: Request) {
  if (!env.ENABLE_AI_FEATURES) {
    return new Response('AI features are disabled until ENABLE_AI_FEATURES=true.', { status: 503 });
  }

  const body = await req.json();
  const { messages, tenantSlug, conversationId = `conv_${Date.now()}` } = body as {
    messages: UIMessage[];
    tenantSlug: string;
    conversationId?: string;
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

  let provider;
  try {
    provider = getAIProvider();
  } catch (error) {
    logger.error({ error }, 'Mkety AI provider is not configured');
    return new Response('AI provider is not configured for this environment.', { status: 503 });
  }

  const model = getAIModel();
  const modelMessages = await convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0]);
  const systemPrompt = `You are the Mkety AI assistant for ${tenant.name}.\nYou help users with their questions and tasks across the Mkety platform.\nBe helpful, concise, and professional.\nDo not claim to have performed actions you did not perform.\nCurrent user: ${session.user.name || session.user.email}`;

  const parts = messages.at(-1)?.parts as Array<{ type: string; text?: string }> | undefined;
  const messagePreview = parts?.map((p) => (p.type === 'text' ? p.text : '')).join(' ').slice(0, 100) || '';
  logAuditEvent({
    tenantId: tenant.id,
    actorId: person.id,
    action: AuditActions.AI_CONVERSATION,
    entityType: 'ai_assistant',
    metadata: { messagePreview, messageCount: messages.length, provider: env.MKETY_AI_PROVIDER, model },
    aiModelVersion: model,
  }).catch((err) => logger.error({ error: err }, 'Failed to log AI conversation'));

  const result = streamText({
    model: provider.chatModel(model),
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
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
}
