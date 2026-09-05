import { buildDefaultWorkflowDefinition, buildWorkflowDraftInput, slugifyWorkflowName } from './workflow-drafts';

describe('automation workflow drafts', () => {
  it('creates stable slugs from workflow names', () => {
    expect(slugifyWorkflowName('Lead Follow Up!!!')).toBe('lead-follow-up');
    expect(slugifyWorkflowName('  WhatsApp + Email Reminder  ')).toBe('whatsapp-email-reminder');
  });

  it('normalizes draft input without enabling execution', () => {
    const draft = buildWorkflowDraftInput({
      description: 'Follow up with new leads.',
      name: 'Lead Follow Up',
      projectId: 'project-1',
      tenantId: 'tenant-1',
    });

    expect(draft).toEqual({
      definition: buildDefaultWorkflowDefinition(),
      description: 'Follow up with new leads.',
      name: 'Lead Follow Up',
      projectId: 'project-1',
      slug: 'lead-follow-up',
      status: 'draft',
      tenantId: 'tenant-1',
      triggerType: 'manual',
      version: '1',
    });
  });

  it('requires a usable workflow name', () => {
    expect(() =>
      buildWorkflowDraftInput({
        description: '',
        name: '!!!',
        projectId: 'project-1',
        tenantId: 'tenant-1',
      }),
    ).toThrow('Workflow name is required.');
  });
});
