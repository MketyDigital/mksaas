export type ConversationMemory = {
  preferences: string[];
  knownFacts: string[];
  goals: string[];
  openQuestions: string[];
  decisions: string[];
  commitments: string[];
  latestState: string;
};

export type ModelUsage = {
  provider: string;
  providerModel: string;
  inputUnits: number;
  outputUnits: number;
  providerCostMicros: number;
  attemptId?: string;
};

type ArchivedMessage = { role: string; content: string; createdAt?: number };
type MemorySummarizer = (input: {
  previous: ConversationMemory;
  messages: ArchivedMessage[];
  maxOutputTokens: 256;
}) => Promise<{ summary: ConversationMemory | null; usage: ModelUsage[] }>;

export type MemorySummaryInput = {
  existingSummary?: ConversationMemory | null;
  existingSummaryThrough?: number;
  memoryClearedAt?: number;
  messages: ArchivedMessage[];
  archivedSinceLastSummary?: number;
  recentWindowWouldLoseContext?: boolean;
  reservedBudgetAvailable?: boolean;
  summarizer?: MemorySummarizer;
};

const MAX_MEMORY_CHARS = 1024;
const MAX_ITEMS_PER_FIELD = 6;

export function emptyConversationMemory(): ConversationMemory {
  return { preferences: [], knownFacts: [], goals: [], openQuestions: [], decisions: [], commitments: [], latestState: "" };
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))].slice(-MAX_ITEMS_PER_FIELD);
}

function normalizedMemory(value?: ConversationMemory | null): ConversationMemory {
  if (!value) return emptyConversationMemory();
  return {
    preferences: unique(value.preferences || []),
    knownFacts: unique(value.knownFacts || []),
    goals: unique(value.goals || []),
    openQuestions: unique(value.openQuestions || []),
    decisions: unique(value.decisions || []),
    commitments: unique(value.commitments || []),
    latestState: clean(value.latestState),
  };
}

function capMemory(memory: ConversationMemory): ConversationMemory {
  const bounded = normalizedMemory(memory);
  const estimate = () => Math.ceil(JSON.stringify(bounded).length / 4);
  while (estimate() > 256) {
    const field = ["knownFacts", "openQuestions", "commitments", "goals", "decisions", "preferences"]
      .find((key) => bounded[key as keyof ConversationMemory] instanceof Array
        && (bounded[key as keyof ConversationMemory] as string[]).length > 1);
    if (!field) {
      bounded.latestState = bounded.latestState.slice(0, Math.max(0, MAX_MEMORY_CHARS - 64));
      break;
    }
    (bounded[field as keyof ConversationMemory] as string[]).shift();
  }
  return bounded;
}

function sentenceParts(message: ArchivedMessage): string[] {
  const text = clean(message.content);
  if (!text) return [];
  return (text.match(/[^.!?]+(?:[.!?]+|$)/g) || [text]).map(clean).filter(Boolean);
}

function deterministicSummary(previous: ConversationMemory, messages: ArchivedMessage[]): ConversationMemory {
  const result = normalizedMemory(previous);
  for (const message of messages) {
    const sentences = sentenceParts(message);
    if (!sentences.length) continue;
    if (message.role === "user") {
      for (const sentence of sentences) {
        if (/\b(prefer|preference|like|likes|rather|please use|call me)\b/i.test(sentence)) result.preferences.push(sentence);
        if (/\b(want|wants|goal|hope|plan|planning|trying to|looking to)\b/i.test(sentence)) result.goals.push(sentence);
        if (/\?\s*$/.test(sentence)) result.openQuestions.push(sentence);
        if (/\b(decided|choose|chose|selected|going with)\b/i.test(sentence)) result.decisions.push(sentence);
        if (/\b(i'll|i will|we'll|we will|promise|promised|will follow up)\b/i.test(sentence)) result.commitments.push(sentence);
        if (!/\b(prefer|preference|like|likes|rather|please use|call me|want|wants|goal|hope|plan|planning|trying to|looking to|decided|choose|chose|selected|going with|i'll|i will|we'll|we will|promise|promised|will follow up)\b/i.test(sentence)
          && !/\?\s*$/.test(sentence)) result.knownFacts.push(sentence);
      }
    } else if (/\b(i will|we will|i'll|we'll|follow up|check back)\b/i.test(message.content)) {
      result.commitments.push(sentences.at(-1) || "");
    }
  }
  const latest = [...messages].reverse().find((message) => clean(message.content));
  if (latest) result.latestState = clean(latest.content);
  return capMemory({
    ...result,
    preferences: unique(result.preferences),
    knownFacts: unique(result.knownFacts),
    goals: unique(result.goals),
    openQuestions: unique(result.openQuestions),
    decisions: unique(result.decisions),
    commitments: unique(result.commitments),
  });
}

export async function summarizeArchivedMessages(input: MemorySummaryInput): Promise<{
  summary: ConversationMemory;
  usage: ModelUsage[];
}> {
  const clearedAt = Math.max(0, Number(input.memoryClearedAt || 0));
  const previousWasCleared = clearedAt > 0
    && (!input.existingSummaryThrough || Number(input.existingSummaryThrough) <= clearedAt);
  const previous = previousWasCleared ? emptyConversationMemory() : normalizedMemory(input.existingSummary);
  const messages = input.messages.filter((message) => message.createdAt == null
    ? clearedAt === 0
    : Number(message.createdAt) > clearedAt);
  const refreshDue = Boolean(input.recentWindowWouldLoseContext)
    || Number(input.archivedSinceLastSummary || 0) >= 12
    || (!input.existingSummary && messages.length > 0);

  if (!refreshDue) return { summary: previous, usage: [] };
  if (input.reservedBudgetAvailable && input.summarizer) {
    const result = await input.summarizer({ previous, messages, maxOutputTokens: 256 });
    const usage = Array.isArray(result.usage) ? result.usage : [];
    if (result.summary) return { summary: capMemory(result.summary), usage };
    return { summary: deterministicSummary(previous, messages), usage };
  }
  return { summary: deterministicSummary(previous, messages), usage: [] };
}
