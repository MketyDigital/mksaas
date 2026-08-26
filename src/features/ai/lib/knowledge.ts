import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/shared/db';
import { knowledgeChunks, knowledgeDocuments } from '@/shared/db/schema';

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 180;

export type KnowledgeChunkInput = {
  content: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeSearchResult = {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export function chunkText(text: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP): KnowledgeChunkInput[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (chunkSize <= overlap || overlap < 0) throw new Error('chunkSize must be greater than overlap.');

  const chunks: KnowledgeChunkInput[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end);
      if (boundary > start + Math.floor(chunkSize * 0.6)) end = boundary;
    }

    const content = normalized.slice(start, end).trim();
    if (content) chunks.push({ content });
    if (end >= normalized.length) break;

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export async function replaceKnowledgeDocumentChunks({
  tenantId,
  projectId,
  documentId,
  chunks,
}: {
  tenantId: string;
  projectId: string;
  documentId: string;
  chunks: KnowledgeChunkInput[];
}) {
  const document = await db.query.knowledgeDocuments.findFirst({
    where: and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.tenantId, tenantId), eq(knowledgeDocuments.projectId, projectId)),
  });
  if (!document) throw new Error('Knowledge document not found.');

  await db.transaction(async (tx) => {
    await tx.delete(knowledgeChunks).where(
      and(eq(knowledgeChunks.documentId, documentId), eq(knowledgeChunks.tenantId, tenantId), eq(knowledgeChunks.projectId, projectId)),
    );

    if (chunks.length) {
      await tx.insert(knowledgeChunks).values(
        chunks.map((chunk, index) => ({
          tenantId,
          projectId,
          documentId,
          chunkIndex: index,
          content: chunk.content,
          metadata: chunk.metadata ?? null,
        })),
      );
    }

    await tx.update(knowledgeDocuments).set({
      chunkCount: chunks.length,
      status: chunks.length ? 'ready' : 'empty',
      updatedAt: new Date(),
    }).where(and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.tenantId, tenantId), eq(knowledgeDocuments.projectId, projectId)));
  });
}

export async function searchKnowledge({
  tenantId,
  projectId,
  queryEmbedding,
  limit = 5,
}: {
  tenantId: string;
  projectId: string;
  queryEmbedding: number[];
  limit?: number;
}): Promise<KnowledgeSearchResult[]> {
  if (!queryEmbedding.length) return [];
  const safeLimit = Math.min(20, Math.max(1, Math.floor(limit)));

  const embedding = sql.raw(`'[${queryEmbedding.map((value) => Number(value)).join(',')}]'`);
  const distance = sql<number>`(${knowledgeChunks.embedding} <=> ${embedding}::vector)`;

  const rows = await db.select({
    id: knowledgeChunks.id,
    documentId: knowledgeChunks.documentId,
    content: knowledgeChunks.content,
    metadata: knowledgeChunks.metadata,
    similarity: sql<number>`1 - ${distance}`,
  }).from(knowledgeChunks).where(
    and(eq(knowledgeChunks.tenantId, tenantId), eq(knowledgeChunks.projectId, projectId), sql`${knowledgeChunks.embedding} IS NOT NULL`),
  ).orderBy(distance).limit(safeLimit);

  return rows;
}
