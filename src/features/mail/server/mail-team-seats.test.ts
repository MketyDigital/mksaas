const mockMemberFindMany = jest.fn();
const mockThreadFindMany = jest.fn();

jest.mock('drizzle-orm', () => ({
  and: jest.fn((...args: unknown[]) => args),
  eq: jest.fn((...args: unknown[]) => args),
  isNotNull: jest.fn((value: unknown) => value),
}));

jest.mock('@/shared/db/cloudflare', () => ({
  db: {
    query: {
      mailMailboxMembers: { findMany: (...args: unknown[]) => mockMemberFindMany(...args) },
      mailThreads: { findMany: (...args: unknown[]) => mockThreadFindMany(...args) },
    },
  },
}));

jest.mock('@/shared/db/schema', () => ({
  mailMailboxMembers: { tenantId: 'member-tenant', userId: 'member-user' },
  mailThreads: { tenantId: 'thread-tenant', assignedUserId: 'thread-assignee' },
}));

import { canAssignMailTeamSeat } from './mail-team-seats';

describe('Mail shared inbox seat policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMemberFindMany.mockResolvedValue([]);
    mockThreadFindMany.mockResolvedValue([]);
  });

  it('allows an existing mailbox member to be assigned without consuming another seat', async () => {
    mockMemberFindMany.mockResolvedValue([{ userId: 'owner' }, { userId: 'agent-1' }]);
    mockThreadFindMany.mockResolvedValue([{ assignedUserId: 'agent-2' }]);

    await expect(canAssignMailTeamSeat('tenant-1', 'agent-1', 3)).resolves.toBe(true);
  });

  it('allows a user who is already assigned on another thread to reuse the same seat', async () => {
    mockMemberFindMany.mockResolvedValue([{ userId: 'owner' }, { userId: 'agent-1' }]);
    mockThreadFindMany.mockResolvedValue([{ assignedUserId: 'agent-2' }]);

    await expect(canAssignMailTeamSeat('tenant-1', 'agent-2', 3)).resolves.toBe(true);
  });

  it('blocks a new assignee when distinct mailbox members and thread assignees fill the plan seats', async () => {
    mockMemberFindMany.mockResolvedValue([{ userId: 'owner' }, { userId: 'agent-1' }]);
    mockThreadFindMany.mockResolvedValue([{ assignedUserId: 'agent-2' }, { assignedUserId: null }]);

    await expect(canAssignMailTeamSeat('tenant-1', 'agent-3', 3)).resolves.toBe(false);
    expect(mockMemberFindMany).toHaveBeenCalledWith(expect.objectContaining({
      columns: { userId: true },
    }));
    expect(mockThreadFindMany).toHaveBeenCalledWith(expect.objectContaining({
      columns: { assignedUserId: true },
    }));
  });

  it('allows a new assignee while a plan seat remains available', async () => {
    mockMemberFindMany.mockResolvedValue([{ userId: 'owner' }]);
    mockThreadFindMany.mockResolvedValue([{ assignedUserId: 'agent-1' }]);

    await expect(canAssignMailTeamSeat('tenant-1', 'agent-2', 3)).resolves.toBe(true);
  });

  it('does not impose public plan seat limits on the internal custom profile', async () => {
    await expect(canAssignMailTeamSeat('tenant-1', 'agent-1', null)).resolves.toBe(true);
    expect(mockMemberFindMany).not.toHaveBeenCalled();
    expect(mockThreadFindMany).not.toHaveBeenCalled();
  });
});
