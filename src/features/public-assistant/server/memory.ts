import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '@/shared/db';
import {
  publicAIConversations,
  publicAIMessages,
  publicAIVisitors,
} from '@/shared/db/schema';

export const PUBLIC_AI_HISTORY_LIMIT = 20;
export const PUBLIC_AI_MESSAGE_CONTEXT_LIMIT = 30;

export type PublicAIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export function derivePublicConversationTitle(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 60) : 'Mkety AI';
}

export async function ensurePublicAIVisitor(visitorId: string) {
  const now = new Date();
  const [visitor] = await db
    .insert(publicAIVisitors)
    .values({ id: visitorId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: publicAIVisitors.id,
      set: { lastSeenAt: now },
    })
    .returning();

  return visitor;
}

export async function createPublicAIConversation(visitorId: string, firstMessage?: string) {
  await ensurePublicAIVisitor(visitorId);
  const [conversation] = await db
    .insert(publicAIConversations)
    .values({
      visitorId,
      title: firstMessage ? derivePublicConversationTitle(firstMessage) : 'Mkety AI',
    })
    .returning();

  return conversation;
}

export async function listPublicAIConversations(visitorId: string) {
  return db.query.publicAIConversations.findMany({
    where: eq(publicAIConversations.visitorId, visitorId),
    orderBy: [desc(publicAIConversations.updatedAt)],
    limit: PUBLIC_AI_HISTORY_LIMIT,
  });
}

export async function getPublicAIConversation(visitorId: string, conversationId: string) {
  const conversation = await db.query.publicAIConversations.findFirst({
    where: and(
      eq(publicAIConversations.id, conversationId),
      eq(publicAIConversations.visitorId, visitorId),
    ),
  });

  if (!conversation) return null;

  const messages = await db.query.publicAIMessages.findMany({
    where: eq(publicAIMessages.conversationId, conversation.id),
    orderBy: [desc(publicAIMessages.createdAt)],
    limit: PUBLIC_AI_MESSAGE_CONTEXT_LIMIT,
  });

  return { conversation, messages: messages.reverse() };
}

export async function appendPublicAIMessage(input: {
  visitorId: string;
  conversationId: string;
  role: PublicAIMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const conversation = await db.query.publicAIConversations.findFirst({
    where: and(
      eq(publicAIConversations.id, input.conversationId),
      eq(publicAIConversations.visitorId, input.visitorId),
    ),
  });
  if (!conversation) return null;

  const [message] = await db
    .insert(publicAIMessages)
    .values({
      conversationId: conversation.id,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .returning();

  await db
    .update(publicAIConversations)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(publicAIConversations.id, conversation.id),
        eq(publicAIConversations.visitorId, input.visitorId),
      ),
    );

  return message;
}

export async function getPublicAIConversationMessages(visitorId: string, conversationId: string) {
  const result = await getPublicAIConversation(visitorId, conversationId);
  return result?.messages ?? [];
}

export async function deletePublicAIConversation(visitorId: string, conversationId: string) {
  const deleted = await db
    .delete(publicAIConversations)
    .where(
      and(
        eq(publicAIConversations.id, conversationId),
        eq(publicAIConversations.visitorId, visitorId),
      ),
    )
    .returning({ id: publicAIConversations.id });

  return deleted.length > 0;
}

export async function clearPublicAIHistory(visitorId: string) {
  await db.delete(publicAIConversations).where(eq(publicAIConversations.visitorId, visitorId));
  await db.delete(publicAIVisitors).where(eq(publicAIVisitors.id, visitorId));
}

export async function listPublicAIConversationMessages(visitorId: string, conversationId: string) {
  const result = await getPublicAIConversation(visitorId, conversationId);
  if (!result) return [];

  return db.query.publicAIMessages.findMany({
    where: eq(publicAIMessages.conversationId, conversationId),
    orderBy: [asc(publicAIMessages.createdAt)],
  });
}
