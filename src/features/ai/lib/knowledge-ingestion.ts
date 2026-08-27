import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { knowledgeChunks, knowledgeDocuments } from '@/shared/db/schema';

import { chunkText } from './knowledge';
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

  await db
    .update(knowledgeDocuments)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(
      and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.tenantId, tenantId),
        eq(knowledgeDocuments.projectId, projectId),
      ),
    );

  try {
    const embeddedChunks = [];
    for (const chunk of chunks) {
      const embedding = await embedKnowledgeText(chunk.content);
      embeddedChunks.push({ ...chunk, embedding });
    }

    const document = await db.query.knowledgeDocuments.findFirst({
      where: and(
        eq(knowledgeDocuments.id, documentId),
        eq(knowledgeDocuments.tenantId, tenantId),
        eq(knowledgeDocuments.projectId, projectId),
      ),
    });
    if (!document) throw new Error('Knowledge document not found.');

    await db.transaction(async (tx) => {
      await tx
        .delete(knowledgeChunks)
        .where(
          and(
            eq(knowledgeChunks.documentId, documentId),
            eq(knowledgeChunks.tenantId, tenantId),
            eq(knowledgeChunks.projectId, projectId),
          ),
        );

      if (embeddedChunks.length) {
        await tx.insert(knowledgeChunks).values(
          embeddedChunks.map((chunk, index) => ({
            tenantId,
            projectId,
            documentId,
            chunkIndex: index,
            content: chunk.content,
            metadata: chunk.metadata ?? null,
            embedding: chunk.embedding,
            embeddingModel: 'text-embedding-3-small',
          })),
        );
      }

      await tx
        .update(knowledgeDocuments)
        .set({
          chunkCount: embeddedChunks.length,
          status: embeddedChunks.length ? 'ready' : 'empty',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(knowledgeDocuments.id, documentId),
            eq(knowledgeDocuments.tenantId, tenantId),
            eq(knowledgeDocuments.projectId, projectId),
          ),
        );
    });
  } catch (error) {
    await db
      .update(knowledgeDocuments)
      .set({ status: 'error', updatedAt: new Date() })
      .where(
        and(
          eq(knowledgeDocuments.id, documentId),
          eq(knowledgeDocuments.tenantId, tenantId),
          eq(knowledgeDocuments.projectId, projectId),
        ),
      );
    throw error;
  }
}
