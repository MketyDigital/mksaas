import { canAssignMailTeamSeat } from './mail-team-seats';

describe('Mail shared inbox seat policy', () => {
  it('allows an existing mailbox member to be assigned without consuming another seat', () => {
    expect(canAssignMailTeamSeat('agent-1', 3, [
      { userId: 'owner' },
      { userId: 'agent-1' },
    ], [
      { assignedUserId: 'agent-2' },
    ])).toBe(true);
  });

  it('allows a user who is already assigned on another thread to reuse the same seat', () => {
    expect(canAssignMailTeamSeat('agent-2', 3, [
      { userId: 'owner' },
      { userId: 'agent-1' },
    ], [
      { assignedUserId: 'agent-2' },
    ])).toBe(true);
  });

  it('blocks a new assignee when distinct mailbox members and thread assignees fill plan seats', () => {
    expect(canAssignMailTeamSeat('agent-3', 3, [
      { userId: 'owner' },
      { userId: 'agent-1' },
    ], [
      { assignedUserId: 'agent-2' },
      { assignedUserId: null },
    ])).toBe(false);
  });

  it('deduplicates a user who is both a mailbox member and a thread assignee', () => {
    expect(canAssignMailTeamSeat('agent-2', 3, [
      { userId: 'owner' },
      { userId: 'agent-2' },
    ], [
      { assignedUserId: 'agent-2' },
    ])).toBe(true);
    expect(canAssignMailTeamSeat('agent-3', 3, [
      { userId: 'owner' },
      { userId: 'agent-2' },
    ], [
      { assignedUserId: 'agent-2' },
    ])).toBe(true);
  });

  it('allows a new assignee while a plan seat remains available', () => {
    expect(canAssignMailTeamSeat('agent-2', 3, [
      { userId: 'owner' },
    ], [
      { assignedUserId: 'agent-1' },
    ])).toBe(true);
  });

  it('does not impose public plan seat limits on the internal custom profile', () => {
    expect(canAssignMailTeamSeat('agent-1', null, [], [])).toBe(true);
  });
});
