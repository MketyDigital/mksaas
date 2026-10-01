import type { UIMessage } from 'ai';

import { listByokProviderConnections } from '@/features/ai-runtime/server/provider-connections';
import { getConversation, getInitialData } from '@/features/assistant';
import { hasEntitlement } from '@/features/entitlements/server/resolver';
import { getTenantBySlug } from '@/shared/lib/tenant';

import { AssistantClient } from './AssistantClient';

interface AssistantPageProps {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ chat?: string }>;
}

export default async function AssistantPage({ params, searchParams }: AssistantPageProps) {
  const { tenant: tenantSlug } = await params;
  const { chat: conversationId } = await searchParams;
  const initialData = await getInitialData(tenantSlug);
  const tenant = await getTenantBySlug(tenantSlug);
  const byokEnabled = tenant
    ? await hasEntitlement({ tenantId: tenant.id, entitlement: 'ai.byok' })
    : false;
  const byokConnections = tenant && byokEnabled
    ? (await listByokProviderConnections({ tenantId: tenant.id }))
        .filter((connection) => connection.status === 'active')
        .map((connection) => ({
          id: connection.id,
          providerKey: connection.providerKey,
        }))
    : [];

  const conversation =
    conversationId && conversationId.trim() !== '' ? await getConversation(tenantSlug, conversationId.trim()) : null;

  return (
    <div className="-mx-4 -my-6 h-[calc(100vh-4rem)]">
      <AssistantClient
        initialData={initialData}
        conversationId={conversation?.id}
        initialMessages={(conversation?.messages as UIMessage[]) ?? undefined}
        initialTitle={conversation?.title}
        providerOptions={byokConnections}
      />
    </div>
  );
}
