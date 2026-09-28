import { MANAGED_AI_MODEL_ALIASES, routeManagedAiTask } from './managed-model-policy';

describe('managed AI model routing policy', () => {
  it('routes economy work to Gemma 4', () => {
    expect(routeManagedAiTask('economy')).toMatchObject({
      alias: MANAGED_AI_MODEL_ALIASES.economy,
      model: { key: 'gemma-4', stage: 'managed-primary' },
      escalationRequired: false,
    });
  });

  it('routes smart work to GLM-5.3 Flash', () => {
    expect(routeManagedAiTask('smart')).toMatchObject({
      alias: MANAGED_AI_MODEL_ALIASES.smart,
      model: { key: 'glm-5.3-flash', stage: 'managed-smart' },
      escalationRequired: false,
    });
  });

  it('uses GLM-5.3 Flash first for heavy work while marking future escalation', () => {
    expect(routeManagedAiTask('heavy')).toMatchObject({
      alias: MANAGED_AI_MODEL_ALIASES.smart,
      model: { key: 'glm-5.3-flash' },
      escalationRequired: true,
    });
  });
});
