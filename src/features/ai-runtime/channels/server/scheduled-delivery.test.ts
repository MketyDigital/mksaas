/** @jest-environment node */
import { deliverEnterpriseAiScheduledActionById } from './scheduled-delivery';

let mockAction: {
  id: string;
  tenantId: string;
  connectionId: string;
  conversationId: string;
  solutionInstanceId: null;
  kind: string;
  status: string;
  dueAt: Date;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
};
let mockDispatches = 0;
let mockOutcome: 'timeout' | 'capacity' | 'success' = 'timeout';
let mockReplyFails = false;
let mockDispatchStatus = '';
let mockOwnsDispatch = true;
jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    query: {
      aiScheduledActions: { findFirst: async () => ({ ...mockAction }) },
      aiProviderConnections: {
        findFirst: async () => ({
          id: 'connection',
          tenantId: 'tenant',
          projectId: null,
          providerKey: 'channel:telegram',
          mode: 'channel',
          status: 'active',
          secretRef: 'encrypted',
          metadata: {},
        }),
      },
      aiConversations: { findFirst: async () => ({ id: 'conversation', status: 'automated' }) },
    },
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: async () => {
          Object.assign(mockAction, value);
        },
        returning: async () => [],
      }),
    }),
  },
}));
jest.mock('./conversations', () => ({
  beginEnterpriseAiScheduledActionDispatch: async (_id: string, _tenant: string, attempts: number) => {
    if (!mockOwnsDispatch || mockAction.status !== 'claimed' || mockAction.attempts !== attempts) return false;
    mockAction.status = 'reconciliation_required';
    return true;
  },
  claimEnterpriseAiScheduledAction: jest.fn(async () => {
    mockAction.status = 'claimed';
    mockAction.attempts += 1;
    return { ...mockAction };
  }),
  completeEnterpriseAiScheduledAction: jest.fn(async () => {
    mockAction.status = 'sent';
  }),
  failEnterpriseAiScheduledAction: jest.fn(async () => {
    mockAction.status = 'pending';
  }),
  markEnterpriseAiScheduledActionReconciliationRequired: jest.fn(async () => {
    mockAction.status = 'reconciliation_required';
  }),
  scheduleEnterpriseAiAction: async () => {
    if (mockReplyFails) throw new Error('reply_storage_failed');
    return { id: 'reply' };
  },
  recordEnterpriseAiMessage: async () => {},
  markEnterpriseAiConversationOutbound: async () => {},
}));
jest.mock('./runtime', () => ({
  runEnterpriseAiManagedChannelTurn: async () => {
    mockDispatches += 1;
    mockDispatchStatus = mockAction.status;
    if (mockOutcome === 'timeout') throw new Error('Managed channel provider outcome requires reconciliation.');
    if (mockOutcome === 'capacity')
      throw Object.assign(new Error('Provider capacity rejected.'), {
        code: 'ENTERPRISE_AI_PROVIDER_CAPACITY_RETRYABLE',
      });
    return { kind: 'completed', text: 'reply', conversationId: 'conversation', deliveryDelaySeconds: 0 };
  },
}));
jest.mock('./delivery-queue', () => ({ enqueueEnterpriseAiScheduledAction: async () => ({ queued: true }) }));
jest.mock('@/features/ai-runtime/server/commercial-policy', () => ({
  getEnterpriseAiRuntimePolicy: async () => ({ customerInferenceEnabled: true }),
}));
jest.mock('@/features/ai-runtime/server/access', () => ({ hasEnterpriseAiAccess: async () => true }));
jest.mock('@/features/entitlements/server/resolver', () => ({ hasEntitlement: async () => true }));
jest.mock('@/features/ai-runtime/channels/credentials', () => ({ revealChannelCredentials: () => ({}) }));
jest.mock('@/features/ai-runtime/channels/transport', () => ({ deliverEnterpriseAiChannelMessage: async () => ({}) }));

const deliver = () => deliverEnterpriseAiScheduledActionById({ actionId: 'action', tenantId: 'tenant' });
describe('durable inbound provider retry safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatches = 0;
    mockOutcome = 'timeout';
    mockReplyFails = false;
    mockDispatchStatus = '';
    mockOwnsDispatch = true;
    mockAction = {
      id: 'action',
      tenantId: 'tenant',
      connectionId: 'connection',
      conversationId: 'conversation',
      solutionInstanceId: null,
      kind: 'inbound_retry',
      status: 'pending',
      dueAt: new Date(0),
      attempts: 0,
      maxAttempts: 3,
      payload: {
        text: 'hello',
        inboundRetry: {
          originalProviderMessageId: 'original',
          senderId: 'sender',
          externalConversationId: 'chat',
          replyRecipientId: 'recipient',
        },
      },
    };
  });
  it('never contacts a provider after losing the queue claim', async () => {
    mockOwnsDispatch = false;
    await expect(deliver()).resolves.toMatchObject({ status: 'claim_lost' });
    expect(mockDispatches).toBe(0);
  });
  it('does not replay an ambiguous provider result on later queue delivery', async () => {
    await expect(deliver()).rejects.toThrow('reconciliation');
    expect(mockAction.status).toBe('reconciliation_required');
    await deliver();
    expect(mockDispatches).toBe(1);
  });
  it('persists the safe recovery state before dispatch, protecting process loss', async () => {
    await expect(deliver()).rejects.toThrow();
    expect(mockDispatchStatus).toBe('reconciliation_required');
  });
  it('does not replay successful AI when saving the reply fails', async () => {
    mockOutcome = 'success';
    mockReplyFails = true;
    await expect(deliver()).rejects.toThrow('reply_storage_failed');
    expect(mockAction.status).toBe('reconciliation_required');
    await deliver();
    expect(mockDispatches).toBe(1);
  });
  it('retries an explicit capacity rejection and completes the next successful attempt', async () => {
    mockOutcome = 'capacity';
    await expect(deliver()).rejects.toThrow('capacity');
    expect(mockAction.status).toBe('pending');
    mockOutcome = 'success';
    await expect(deliver()).resolves.toMatchObject({ retried: true });
    expect(mockAction.status).toBe('sent');
    expect(mockDispatches).toBe(2);
  });
});
