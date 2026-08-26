import { db } from '@/shared/db';
import { knowledgeDocuments } from '@/shared/db/schema';

import { chunkText, replaceKnowledgeDocumentChunks } from './knowledge';
import { embedKnowledgeText } from './knowledge-provider';

export async function ingestKnowledgeText({
  tenantId,
  projectId,
  documentId,
  text,
}: {
  tenantId: string;
  projectId: string;
  documentId: string;
  text: string;
}) {
  const chunks = chunkText(text);

  await db.update(knowledgeDocuments).set({ status: 'processing', updatedAt: new Date() }).where((table, { and, eq }) =>
    and(eq(table.id, documentId), eq(table.tenantId, tenantId), eq(table.projectId, projectId)),
  );

  try {
    const embeddedChunks = [];
    for (const chunk of chunks) {
      const embedding = await embedKnowledgeText(chunk.content);
      embeddedChunks.push({ ...chunk, embedding });
    }

    // Keep the database write in one replacement operation so a failed
    // ingestion never leaves a mixture of old and new chunks.
    const document = await db.query.knowledgeDocuments.findFirst({
      where: (table, { and, eq }) => and(eq(table.id, documentId), eq(table.tenantId, tenantId), eq(table.projectId, projectId)),
    });
    if (!document) throw new Error('Knowledge document not found.');

    await db.transaction(async (tx) => {
      const { knowledgeChunks } = await import('@/shared/db/schema');
      await tx.delete(knowledgeChunks).where((table, { and, eq }) => and(eq(table.documentId, documentId), eq(table.tenantId, tenantId), eq(table.projectId, projectId)));
      if (embeddedChunks.length) {
        await tx.insert(knowledgeChunks).values(embeddedChunks.map((chunk, index) => ({
          tenantId,
          projectId,
          documentId,
          chunkIndex: index,
          content: chunk.content,
          metadata: chunk.metadata ?? null,
          embedding: chunk.embedding,
          embeddingModel: 'text-embedding-3-small',
        })));
      }
      await tx.update(knowledgeDocuments).set({ chunkCount: embeddedChunks.length, status: embeddedChunks.length ? 'ready' : 'empty', updatedAt: new Date() }).where((table, { and, eq }) => and(eq(table.id, documentId), eq(table.tenantId, tenantId), eq(table.projectId, projectId)));
    });
  } catch (error) {
    await db.update(knowledgeDocuments).set({ status: 'error', updatedAt: new Date() }).where((table, { and, eq }) => and(eq(table.id, documentId), eq(table.tenantId, tenantId), eq(table.projectId, projectId)));
    throw error;
  }
}
