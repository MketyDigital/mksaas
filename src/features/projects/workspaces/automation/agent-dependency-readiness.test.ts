import { resolveAutomationWorkflowDependencies } from './agent-dependency-readiness';

jest.mock('@/shared/db', () => ({ db: { query: { agents: { findFirst: jest.fn() }, agentVersions: { findFirst: jest.fn() } } } }));
import { db } from '@/shared/db';
const agentFind = jest.mocked(db.query.agents.findFirst);
const versionFind = jest.mocked(db.query.agentVersions.findFirst);

describe('resolveAutomationWorkflowDependencies', () => {
  beforeEach(() => { agentFind.mockReset(); versionFind.mockReset(); });
  it('resolves only a published same-scope agent version without mutating definition', async () => {
    agentFind.mockResolvedValue({ id: 'agent-a' } as never);
    versionFind.mockResolvedValue({ id: 'ver-3', agentId: 'agent-a', version: 3, name: 'Writer', instructions: 'Write', provider: 'platform', model: null, config: null, status: 'published' } as never);
    const definition = { nodes: [{ id: 'agent-1', type: 'agent', config: { agentId: 'agent-a', prompt: 'Hello' } }] };
    const before = JSON.parse(JSON.stringify(definition));
    const result = await resolveAutomationWorkflowDependencies({ context: { tenantId: 't1', projectId: 'p1' }, definition });
    expect(result.ready).toBe(true);
    expect(result.agents['agent-1']).toEqual(expect.objectContaining({ versionId: 'ver-3', version: 3, agentId: 'agent-a' }));
    expect(definition).toEqual(before);
  });
  it('blocks missing and unpublished agents', async () => {
    agentFind.mockResolvedValueOnce(undefined as never).mockResolvedValueOnce({ id: 'agent-b' } as never);
    versionFind.mockResolvedValue(undefined as never);
    const result = await resolveAutomationWorkflowDependencies({ context: { tenantId: 't1', projectId: 'p1' }, definition: { nodes: [{ id: 'a1', type: 'agent', config: { agentId: 'missing', prompt: 'x' } }, { id: 'a2', type: 'agent', config: { agentId: 'agent-b', prompt: 'y' } }] } });
    expect(result.ready).toBe(false);
    expect(result.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['agent.dependency-not-found', 'agent.dependency-no-published-version']));
  });
});
