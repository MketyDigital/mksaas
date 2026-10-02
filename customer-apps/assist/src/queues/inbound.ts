export type InboundUpdate = {
  assistantId: string;
  providerEventId: string;
  update: Record<string, unknown>;
};

export type InboundQueue = { send(body: unknown): Promise<void> };

export function validateInboundUpdate(value: unknown): InboundUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_inbound_update");
  const candidate = value as Record<string, unknown>;
  const update = candidate.update;
  if (!update || typeof update !== "object" || Array.isArray(update)) throw new Error("invalid_inbound_update");
  const providerEventId = String(candidate.providerEventId || (update as any).update_id || "").trim();
  const assistantId = String(candidate.assistantId || "").trim();
  if (!assistantId || !/^[a-zA-Z0-9_-]{1,120}$/.test(assistantId) || !providerEventId || providerEventId.length > 160) {
    throw new Error("invalid_inbound_identity");
  }
  const serialized = JSON.stringify(update);
  if (serialized.length > 256_000) throw new Error("inbound_payload_too_large");
  if (String((update as any).update_id ?? "") !== providerEventId) throw new Error("inbound_event_id_mismatch");
  return { assistantId, providerEventId, update: update as Record<string, unknown> };
}

export async function enqueueInboundUpdate(queue: InboundQueue, value: unknown): Promise<InboundUpdate> {
  const payload = validateInboundUpdate(value);
  await queue.send(payload);
  return payload;
}

export async function replayInboundUpdate<T>(value: unknown, replay: (payload: InboundUpdate) => Promise<T>): Promise<T> {
  return replay(validateInboundUpdate(value));
}
