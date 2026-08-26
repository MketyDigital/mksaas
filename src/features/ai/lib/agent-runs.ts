import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { agentRuns } from '@/shared/db/schema';

export async function completeAgentRun(runId: string, output: string, usage?: { inputTokens?: number; outputTokens?: number }) {
  await db.update(agentRuns).set({ status: 'completed', output, inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, completedAt: new Date() }).where(eq(agentRuns.id, runId));
}

export async function failAgentRun(runId: string, error: unknown) {
  await db.update(agentRuns).set({ status: 'error', error: error instanceof Error ? error.message : 'Agent execution failed.', completedAt: new Date() }).where(eq(agentRuns.id, runId));
}
