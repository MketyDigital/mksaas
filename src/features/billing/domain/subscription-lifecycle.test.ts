import { canTransitionSubscription } from './subscription-lifecycle';

describe('canTransitionSubscription', () => {
  it('allows a trialing subscription to become active', () => {
    expect(canTransitionSubscription('trialing', 'active')).toBe(true);
  });

  it('allows an active subscription to cancel at period end', () => {
    expect(canTransitionSubscription('active', 'cancel_at_period_end')).toBe(true);
  });

  it('allows a past-due subscription to recover to active', () => {
    expect(canTransitionSubscription('past_due', 'active')).toBe(true);
  });

  it('treats cancelled as terminal and rejects resurrection', () => {
    expect(canTransitionSubscription('cancelled', 'active')).toBe(false);
    expect(canTransitionSubscription('cancelled', 'trialing')).toBe(false);
  });
});