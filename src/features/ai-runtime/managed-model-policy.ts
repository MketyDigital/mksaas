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


const SMART_TASK_PATTERN =
  /\b(code|coding|debug|bug|refactor|architecture|reasoning|analy[sz]e|compare|plan|strategy|sql|typescript|javascript|python|api|schema|migration|workflow|agent|tool|function|deploy|security|financial model|forecast)\b/i;

const HEAVY_TASK_PATTERN =
  /\b(repo[- ]wide|multi[- ]step|deep analysis|complex architecture|large refactor|app builder|build an app|production migration|autonomous|long[- ]running)\b/i;

export function classifyManagedAiTask(input: {
  messages: Array<{ role: string; content: string }>;
  requested?: ManagedAiTaskClass | null;
}): ManagedAiTaskClass {
  if (input.requested) return input.requested;

  const text = input.messages
    .filter((message) => message.role === 'user')
    .slice(-4)
    .map((message) => message.content)
    .join('\n');

  if (HEAVY_TASK_PATTERN.test(text) || text.length > 12_000) return 'heavy';
  if (SMART_TASK_PATTERN.test(text) || text.length > 3_500) return 'smart';
  return 'economy';
}
