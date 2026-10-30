import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';

import { findActiveMketyAppDeployment } from '@/features/deploy/server/hostname-repository';
import { withRequestDatabase } from '@/shared/db/request';

function authorized(request: Request) {
  const secret = typeof env.MKETY_DEPLOYMENT_LOOKUP_SECRET === 'string'
    ? env.MKETY_DEPLOYMENT_LOOKUP_SECRET
    : '';
  return secret.length >= 32 && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const hostname = request.headers.get('x-mkety-customer-host') ?? '';
  return withRequestDatabase(async () => {
    const deployment = await findActiveMketyAppDeployment(hostname);
    if (!deployment) return NextResponse.json({ ok: false }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({
      ok: true,
      deployment: {
        deploymentId: deployment.deploymentId,
        tenantId: deployment.tenantId,
        kind: deployment.kind,
        providerDeploymentRef: deployment.providerDeploymentRef,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
