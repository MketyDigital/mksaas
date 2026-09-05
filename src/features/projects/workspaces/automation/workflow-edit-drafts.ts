export type WorkflowMetadataUpdateInput = {
  name: string;
  description: string | null;
};

export function buildWorkflowMetadataUpdateInput({
  description,
  name,
}: {
  name: string;
  description: string;
}): WorkflowMetadataUpdateInput {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error('Workflow name is required.');
  }

  const normalizedDescription = description.trim();

  return {
    description: normalizedDescription || null,
    name: normalizedName,
  };
}
