import { z } from 'zod';

import { withRequestDatabase } from '@/shared/db/request';
import { publicSupportLeads } from '@/shared/db/schema';

const leadSchema = z.object({
  conversationId: z.uuid().nullable().optional(),
  intent: z.enum(['support', 'sales', 'enterprise', 'general']).default('general'),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(80).optional(),
  message: z.string().trim().min(5).max(2000),
  sourcePath: z.string().trim().max(500).optional(),
  website: z.string().max(0).optional(),
});

function sameOriginAllowed(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOriginAllowed(request)) return Response.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const input = leadSchema.parse(await request.json());
    if (input.website) return Response.json({ received: true });

    await withRequestDatabase(async (db) => {
      await db.insert(publicSupportLeads).values({
        conversationId: input.conversationId ?? null,
        intent: input.intent,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        message: input.message,
        sourcePath: input.sourcePath || null,
      });
    });

    return Response.json({ received: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'Please check your contact details and message.' }, { status: 400 });
    }
    return Response.json({ error: 'Could not save your request just now.' }, { status: 503 });
  }
}
