import { embed } from 'ai';

import { getAIProvider } from './provider';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

export async function embedKnowledgeText(text: string, modelName = DEFAULT_EMBEDDING_MODEL) {
  if (!text.trim()) throw new Error('Cannot embed empty text.');

  const provider = getAIProvider('platform');
  const embeddingModel = provider.textEmbeddingModel(modelName);
  const result = await embed({ model: embeddingModel, value: text });

  return result.embedding;
}
