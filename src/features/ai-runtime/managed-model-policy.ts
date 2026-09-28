import { getManagedAiModelCandidate, type ManagedAiModelCandidate } from './model-candidates';

export type ManagedAiTaskClass = 'economy' | 'smart' | 'heavy';

export const MANAGED_AI_MODEL_ALIASES = {
  economy: 'mkety-economy',
  smart: 'mkety-smart',
} as const;

export interface ManagedAiRoutingDecision {
  taskClass: ManagedAiTaskClass;
  alias: (typeof MANAGED_AI_MODEL_ALIASES)[keyof typeof MANAGED_AI_MODEL_ALIASES];
  model: ManagedAiModelCandidate;
  escalationRequired: boolean;
}

export function routeManagedAiTask(taskClass: ManagedAiTaskClass): ManagedAiRoutingDecision {
  if (taskClass === 'economy') {
    return {
      taskClass,
      alias: MANAGED_AI_MODEL_ALIASES.economy,
      model: getManagedAiModelCandidate('gemma-4')!,
      escalationRequired: false,
    };
  }

  return {
    taskClass,
    alias: MANAGED_AI_MODEL_ALIASES.smart,
    model: getManagedAiModelCandidate('glm-5.3-flash')!,
    escalationRequired: taskClass === 'heavy',
  };
}
