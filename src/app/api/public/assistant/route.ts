import { z } from 'zod';

import { publicAssistantDeleteSchema, publicAssistantMessageSchema } from '@/features/public-assistant/contracts';
import { summarizeErrorChain } from '@/features/public-assistant/server/error-diagnostics';
import {
  clearPublicAIHistory,
  deletePublicAIConversation,
  ensurePublicAIVisitor,
  getPublicAIConversation,
  getPublicAIRecentUserMessageCount,
  listPublicAIConversations,
  PUBLIC_AI_RATE_LIMIT_PER_MINUTE,
} from '@/features/public-assistant/server/memory';
import { withPublicAIRequestDatabase } from '@/features/public-assistant/server/request-database';
import { PublicAssistantRuntimeError, runMketyPublicAssistant } from '@/features/public-assistant/server/runtime';
import {
  createPublicVisitorToken,
  parsePublicVisitorToken,
  PUBLIC_AI_VISITOR_COOKIE,
} from '@/features/public-assistant/server/visitor';
import type { Database } from '@/shared/db';
import { createLogger } from '@/shared/lib/logger';

export const maxDuration = 30;

const publicAILogger = createLogger({ module: 'public-assistant' });
const PUBLIC_AI_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
const conversationQuerySchema = z.uuid().optional();

function getCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return undefined;
  for (const part of cookie.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

function publicVisitorSecret() {
  const secret = process.env.MKETY_PUBLIC_AI_VISITOR_SECRET;
  if (!secret || secret.length < 32) {
    throw new PublicAssistantRuntimeError('Mkety AI is currently unavailable.', 503);
  }
  return secret;
}

function sameOriginAllowed(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function resolveVisitor(request: Request, database: Database) {
  const secret = publicVisitorSecret();
  const existingToken = getCookie(request, PUBLIC_AI_VISITOR_COOKIE);
  const existingVisitorId = await parsePublicVisitorToken(existingToken, secret);
  const visitorId = existingVisitorId ?? crypto.randomUUID();
  await ensurePublicAIVisitor(database, visitorId);
  return {
    visitorId,
    setCookie: existingVisitorId ? undefined : await createPublicVisitorToken(visitorId, secret),
  };
}

function withVisitorCookie(response: Response, token: string | undefined, request: Request) {
  if (!token) return response;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  response.headers.append(
    'Set-Cookie',
    `${PUBLIC_AI_VISITOR_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${PUBLIC_AI_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  );
  return response;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function safeError(error: unknown) {
  if (error instanceof PublicAssistantRuntimeError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof z.ZodError) {
    return json({ error: 'Invalid Mkety AI request.' }, 400);
  }

  const errorChain = summarizeErrorChain(error);
  const root = errorChain[0];
  const cause = errorChain[1];
  publicAILogger.error(
    {
      errorName: root?.name ?? 'UnknownError',
      errorMessage: root?.message,
      errorCauseName: cause?.name,
      errorCauseMessage: cause?.message,
      errorCauseCode: cause?.code,
    },
    'Mkety public AI request failed',
  );
  return json({ error: 'Mkety AI is temporarily unavailable. Please try again.' }, 503);
}

export async function GET(request: Request) {
  try {
    return await withPublicAIRequestDatabase(async (database) => {
      const visitor = await resolveVisitor(request, database);
      const url = new URL(request.url);
      const requestedConversationId = conversationQuerySchema.parse(
        url.searchParams.get('conversationId') ?? undefined,
      );
      const conversations = await listPublicAIConversations(database, visitor.visitorId);
      const selectedConversationId = requestedConversationId ?? conversations[0]?.id;
      const selected = selectedConversationId
        ? await getPublicAIConversation(database, visitor.visitorId, selectedConversationId)
        : null;

      return withVisitorCookie(
        json({
          conversations: conversations.map((conversation) => ({
            id: conversation.id,
            title: conversation.title,
            updatedAt: conversation.updatedAt,
          })),
          activeConversationId: selected?.conversation.id ?? null,
          messages:
            selected?.messages.map((message) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              createdAt: message.createdAt,
            })) ?? [],
        }),
        visitor.setCookie,
        request,
      );
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await withPublicAIRequestDatabase(async (database) => {
      if (!sameOriginAllowed(request)) return json({ error: 'Forbidden.' }, 403);
      const visitor = await resolveVisitor(request, database);
      const recentCount = await getPublicAIRecentUserMessageCount(
        database,
        visitor.visitorId,
        new Date(Date.now() - 60_000),
      );
      if (recentCount >= PUBLIC_AI_RATE_LIMIT_PER_MINUTE) {
        return withVisitorCookie(
          json({ error: 'Too many requests. Please try again shortly.' }, 429),
          visitor.setCookie,
          request,
        );
      }

      const input = publicAssistantMessageSchema.parse(await request.json());
      const result = await runMketyPublicAssistant({
        database,
        visitorId: visitor.visitorId,
        message: input.message,
        conversationId: input.conversationId,
        environment: process.env,
      });

      return withVisitorCookie(json(result), visitor.setCookie, request);
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return await withPublicAIRequestDatabase(async (database) => {
      if (!sameOriginAllowed(request)) return json({ error: 'Forbidden.' }, 403);
      const visitor = await resolveVisitor(request, database);
      const input = publicAssistantDeleteSchema.parse(await request.json());

      if (input.scope === 'all') {
        await clearPublicAIHistory(database, visitor.visitorId);
        const response = json({ cleared: true });
        response.headers.append(
          'Set-Cookie',
          `${PUBLIC_AI_VISITOR_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
            new URL(request.url).protocol === 'https:' ? '; Secure' : ''
          }`,
        );
        return response;
      }

      const deleted = await deletePublicAIConversation(database, visitor.visitorId, input.conversationId);
      return withVisitorCookie(json({ deleted }), visitor.setCookie, request);
    });
  } catch (error) {
    return safeError(error);
  }
}
