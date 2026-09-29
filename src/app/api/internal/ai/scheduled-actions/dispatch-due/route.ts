import { NextResponse } from 'next/server';

import { listClaimableEnterpriseAiActions } from '@/features/ai-runtime/channels/server/conversations';
import { deliverEnterpriseAiScheduledActionById } from '@/features/ai-runtime/channels/server/scheduled-delivery';

export async function POST(request: Request) {
  const expected = process.env.MKETY_AI_DELIVERY_INTERNAL_SECRET ?? '';
  const provided = request.headers.get('authorization') ?? '';
  if (!expected || provided !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const actions = await listClaimableEnterpriseAiActions(new Date(), 50);
  let delivered = 0;
  let failed = 0;
  for (const action of actions) {
    try {
      const result = await deliverEnterpriseAiScheduledActionById({
        actionId: action.id,
        tenantId: action.tenantId,
      });
      if (result.ok) delivered += 1;
    } catch {
      failed += 1;
    }
  }
  return NextResponse.json({ ok: true, scanned: actions.length, delivered, failed });
}
