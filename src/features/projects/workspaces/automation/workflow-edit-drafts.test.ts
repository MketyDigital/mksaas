import { buildWorkflowMetadataUpdateInput } from './workflow-edit-drafts';

describe('buildWorkflowMetadataUpdateInput', () => {
  it('normalizes name and description without changing runtime fields', () => {
    const update = buildWorkflowMetadataUpdateInput({
      description: '  Follow up with registered leads.  ',
      name: '  Lead Follow Up  ',
    });

    expect(update).toEqual({
      description: 'Follow up with registered leads.',
      name: 'Lead Follow Up',
    });
    expect(update).not.toHaveProperty('definition');
    expect(update).not.toHaveProperty('triggerType');
    expect(update).not.toHaveProperty('status');
  });

  it('allows blank descriptions but requires workflow names', () => {
    expect(buildWorkflowMetadataUpdateInput({ description: '   ', name: 'Renewal reminder' })).toEqual({
      description: null,
      name: 'Renewal reminder',
    });

    expect(() => buildWorkflowMetadataUpdateInput({ description: 'Anything', name: '   ' })).toThrow(
      'Workflow name is required.',
    );
  });
});
