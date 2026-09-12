import { and, desc, eq, gte } from 'drizzle-orm';

import type { Database } from '@/shared/db';
import { publicAIConversations, publicAIMessages, publicAIToolRuns, publicAIVisitors } from '@/shared/db/schema';

export const PUBLIC_AI_HISTORY_LIMIT = 20;
export const PUBLIC_AI_MESSAGE_CONTEXT_LIMIT = 30;
export const PUBLIC_AI_RATE_LIMIT_PER_MINUTE = 12;

export type PublicAIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export function derivePublicConversationTitle(message: string): string {
  const normalized = message.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 60) : 'Mkety AI';
}

export async function ensurePublicAIVisitor(database: Database, visitorId: string) {
  const now = new Date();
  const [visitor] = await database
    .insert(publicAIVisitors)
    .values({ id: visitorId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: publicAIVisitors.id,
      set: { lastSeenAt: now },
    })
    .returning();

  return visitor;
}

export async function createPublicAIConversation(database: Database, visitorId: string, firstMessage?: string) {
  await ensurePublicAIVisitor(database, visitorId);
  const [conversation] = await database
    .insert(publicAIConversations)
    .values({
      visitorId,
      title: firstMessage ? derivePublicConversationTitle(firstMessage) : 'Mkety AI',
    })
    .returning();

  return conversation;
}

export async function listPublicAIConversations(database: Database, visitorId: string) {
  return database.query.publicAIConversations.findMany({
    where: eq(publicAIConversations.visitorId, visitorId),
    orderBy: [desc(publicAIConversations.updatedAt)],
    limit: PUBLIC_AI_HISTORY_LIMIT,
  });
}

export async function getPublicAIConversation(database: Database, visitorId: string, conversationId: string) {
  const conversation = await database.query.publicAIConversations.findFirst({
    where: and(eq(publicAIConversations.id, conversationId), eq(publicAIConversations.visitorId, visitorId)),
  });

  if (!conversation) return null;

  const messages = await database.query.publicAIMessages.findMany({
    where: eq(publicAIMessages.conversationId, conversation.id),
    orderBy: [desc(publicAIMessages.createdAt)],
    limit: PUBLIC_AI_MESSAGE_CONTEXT_LIMIT,
  });

  return { conversation, messages: messages.reverse() };
}

export async function appendPublicAIMessage(
  database: Database,
  input: {
    visitorId: string;
    conversationId: string;
    role: PublicAIMessageRole;
    content: string;
    metadata?: Record<string, unknown>;
  },
) {
  const conversation = await database.query.publicAIConversations.findFirst({
    where: and(
      eq(publicAIConversations.id, input.conversationId),
      eq(publicAIConversations.visitorId, input.visitorId),
    ),
  });
  if (!conversation) return null;

  const [message] = await database
    .insert(publicAIMessages)
    .values({
      conversationId: conversation.id,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .returning();

  await database
    .update(publicAIConversations)
    .set({ updatedAt: new Date() })
    .where(and(eq(publicAIConversations.id, conversation.id), eq(publicAIConversations.visitorId, input.visitorId)));

  return message;
}

export async function recordPublicAIToolRun(
  database: Database,
  input: {
    visitorId: string;
    conversationId: string;
    toolName: string;
    status: 'success' | 'failure';
    metadata?: Record<string, unknown>;
  },
) {
  const conversation = await database.query.publicAIConversations.findFirst({
    where: and(
      eq(publicAIConversations.id, input.conversationId),
      eq(publicAIConversations.visitorId, input.visitorId),
    ),
  });
  if (!conversation) return null;

  const [toolRun] = await database
    .insert(publicAIToolRuns)
    .values({
      conversationId: input.conversationId,
      toolName: input.toolName,
      status: input.status,
      metadata: input.metadata ?? {},
    })
    .returning();

  return toolRun;
}

export async function getPublicAIRecentUserMessageCount(database: Database, visitorId: string, since: Date) {
  const rows = await database
    .select({ id: publicAIMessages.id })
    .from(publicAIMessages)
    .innerJoin(publicAIConversations, eq(publicAIMessages.conversationId, publicAIConversations.id))
    .where(
      and(
        eq(publicAIConversations.visitorId, visitorId),
        eq(publicAIMessages.role, 'user'),
        gte(publicAIMessages.createdAt, since),
      ),
    )
    .limit(PUBLIC_AI_RATE_LIMIT_PER_MINUTE);

  return rows.length;
}

export async function deletePublicAIConversation(database: Database, visitorId: string, conversationId: string) {
  const deleted = await database
    .delete(publicAIConversations)
    .where(and(eq(publicAIConversations.id, conversationId), eq(publicAIConversations.visitorId, visitorId)))
    .returning({ id: publicAIConversations.id });

  return deleted.length > 0;
}

export async function clearPublicAIHistory(database: Database, visitorId: string) {
  await database.delete(publicAIConversations).where(eq(publicAIConversations.visitorId, visitorId));
  await database.delete(publicAIVisitors).where(eq(publicAIVisitors.id, visitorId));
}
