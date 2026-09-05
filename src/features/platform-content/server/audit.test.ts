import { recordPlatformContentAuditEvent } from './audit';

describe('platform content audit writer', () => {
  it('exports the CMS audit writer used by draft and publish actions', () => {
    expect(typeof recordPlatformContentAuditEvent).toBe('function');
  });
});
