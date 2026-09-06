import { NextResponse } from 'next/server';

import { handleAutomationWebhookIngress } from '@/features/projects/workspaces/automation/webhook-ingress';
import { automationWebhookServerDependencies } from '@/features/projects/workspaces/automation/webhook-server-dependencies';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ endpointId: string }> }) {
  const { endpointId } = await params;
  const result = await handleAutomationWebhookIngress({ endpointId, request }, automationWebhookServerDependencies);
  return NextResponse.json(result.body, { status: result.status });
}
