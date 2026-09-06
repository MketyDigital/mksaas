export type WorkflowMetadataUpdateInput = {
  name: string;
  description: string | null;
  triggerType: 'manual' | 'webhook';
};

export function buildWorkflowMetadataUpdateInput({
  description,
  name,
  triggerType,
}: {
  name: string;
  description: string;
  triggerType: string;
}): WorkflowMetadataUpdateInput {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error('Workflow name is required.');
  }

  const normalizedTriggerType = triggerType.trim().toLowerCase();
  if (normalizedTriggerType !== 'manual' && normalizedTriggerType !== 'webhook') {
    throw new Error('Workflow trigger type must be manual or webhook.');
  }

  const normalizedDescription = description.trim();

  return {
    description: normalizedDescription || null,
    name: normalizedName,
    triggerType: normalizedTriggerType,
  };
}
