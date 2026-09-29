import { embedWithManagedWorkersAi } from '@/features/ai-runtime/providers/runtime.cloudflare';

const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-m3';

export async function embedKnowledgeText(text: string, modelName = DEFAULT_EMBEDDING_MODEL) {
  if (!text.trim()) throw new Error('Cannot embed empty text.');
  return embedWithManagedWorkersAi(text, modelName);
}
