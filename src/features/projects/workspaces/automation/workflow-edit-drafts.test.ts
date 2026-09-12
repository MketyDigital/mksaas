import { buildWorkflowMetadataUpdateInput } from './workflow-edit-drafts';

describe('buildWorkflowMetadataUpdateInput', () => {
  it('normalizes name, description, and authoritative trigger type without changing other runtime fields', () => {
    const update = buildWorkflowMetadataUpdateInput({
      description: '  Follow up with registered leads.  ',
      name: '  Lead Follow Up  ',
      triggerType: ' webhook ',
    });

    expect(update).toEqual({
      description: 'Follow up with registered leads.',
      name: 'Lead Follow Up',
      triggerType: 'webhook',
    });
    expect(update).not.toHaveProperty('definition');
    expect(update).not.toHaveProperty('status');
  });

  it('allows blank descriptions but requires workflow names and a supported trigger type', () => {
    expect(buildWorkflowMetadataUpdateInput({ description: '   ', name: 'Renewal reminder', triggerType: 'manual' })).toEqual({
      description: null,
      name: 'Renewal reminder',
      triggerType: 'manual',
    });

    expect(() => buildWorkflowMetadataUpdateInput({ description: 'Anything', name: '   ', triggerType: 'manual' })).toThrow('Workflow name is required.');
    expect(() => buildWorkflowMetadataUpdateInput({ description: 'Anything', name: 'Workflow', triggerType: 'schedule' })).toThrow('Workflow trigger type must be manual or webhook.');
  });
});
