import { NextResponse } from 'next/server';

import { deliverEnterpriseAiScheduledActionById } from '@/features/ai-runtime/channels/server/scheduled-delivery';

export async function POST(request: Request) {
  const expected = process.env.MKETY_AI_DELIVERY_INTERNAL_SECRET ?? '';
  const provided = request.headers.get('authorization') ?? '';
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    actionId?: string;
    tenantId?: string;
  } | null;
  if (!payload?.actionId || !payload.tenantId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    const result = await deliverEnterpriseAiScheduledActionById({
      actionId: payload.actionId,
      tenantId: payload.tenantId,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === 'not_due' ? 409 : 404 });
  } catch {
    return NextResponse.json({ ok: false, retryable: true }, { status: 503 });
  }
}
