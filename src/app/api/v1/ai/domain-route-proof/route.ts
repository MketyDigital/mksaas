import { readEnterpriseAiRouteProof } from '@/features/ai-runtime/server/domain-route-proof';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const proof = await readEnterpriseAiRouteProof(hostname);
  if (!proof) {
    return Response.json(
      { ok: false },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return Response.json(
    {
      ok: true,
      hostname: proof.hostname,
      tenant_id: proof.tenantId,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
