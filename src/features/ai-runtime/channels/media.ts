import { and, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';

import { revealChannelCredentials } from '@/features/ai-runtime/channels/credentials';
import type { EnterpriseAiInboundAttachment } from '@/features/ai-runtime/channels/inbound';
import type { EnterpriseAiChannelKey } from '@/features/ai-runtime/channels/registry';
import { db } from '@/shared/db/cloudflare';
import { aiProviderConnections } from '@/shared/db/schema/ai-runtime';

const MAX_MEDIA_ATTACHMENTS = 3;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 5 * 60;
const MAX_EXTRACTED_CHARACTERS = 24_000;

// Cloudflare currently lists whisper-large-v3-turbo at $0.000513/audio minute.
// Keep this internal; customer charging remains credit-based.
const WHISPER_USD_MICROS_PER_MINUTE = 513n;

// toMarkdown image/document conversion can invoke more than one Workers AI model.
// Cloudflare does not publish one combined per-file tariff, so reserve a bounded,
// deliberately conservative provider-cost ceiling per visual/document conversion.
const VISUAL_CONVERSION_PROVIDER_COST_RESERVE_USD_MICROS = 5_000n;

type WorkersAiMediaBinding = {
  run(model: string, input: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
  toMarkdown(
    file: { name: string; blob: Blob },
    options?: Record<string, unknown>,
  ): Promise<unknown>;
};

export type EnterpriseAiMediaContext = {
  text: string;
  imageInputs: number;
  documentInputs: number;
  audioSeconds: number;
  providerCostUsdMicros: bigint;
};

function ceilDiv(numerator: bigint, denominator: bigint) {
  return (numerator + denominator - 1n) / denominator;
}

function boundedPositiveInteger(value: unknown, max: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.min(max, Math.ceil(numeric))
    : 0;
}

export function estimateEnterpriseAiMediaProviderCostUsdMicros(
  attachments: readonly EnterpriseAiInboundAttachment[] = [],
) {
  const bounded = attachments.slice(0, MAX_MEDIA_ATTACHMENTS);
  let total = 0n;
  for (const attachment of bounded) {
    if (attachment.kind === 'audio') {
      const seconds = boundedPositiveInteger(attachment.durationSeconds, MAX_AUDIO_SECONDS);
      if (seconds) {
        total += ceilDiv(BigInt(seconds) * WHISPER_USD_MICROS_PER_MINUTE, 60n);
      }
    } else {
      total += VISUAL_CONVERSION_PROVIDER_COST_RESERVE_USD_MICROS;
    }
  }
  return total;
}

function safeFileName(attachment: EnterpriseAiInboundAttachment, fallback: string) {
  const supplied = String(attachment.fileName ?? '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return supplied.slice(0, 120) || fallback;
}

async function loadTelegramFile(botToken: string, attachment: EnterpriseAiInboundAttachment) {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(botToken)) {
    throw new Error('Telegram bot token format is invalid.');
  }
  const metadataResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(attachment.providerFileId)}`,
  );
  const metadata = await metadataResponse.json().catch(() => null) as {
    ok?: boolean;
    result?: { file_path?: string; file_size?: number };
  } | null;
  const filePath = String(metadata?.result?.file_path ?? '');
  const declaredSize = Number(metadata?.result?.file_size ?? attachment.sizeBytes ?? 0);
  if (!metadataResponse.ok || !metadata?.ok || !filePath || filePath.includes('..')) {
    throw new Error('Telegram attachment metadata could not be resolved.');
  }
  if (declaredSize > MAX_MEDIA_BYTES) {
    throw new Error('Telegram attachment exceeds the Enterprise AI media size limit.');
  }

  const response = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${filePath.split('/').map(encodeURIComponent).join('/')}`,
  );
  if (!response.ok) throw new Error('Telegram attachment download failed.');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new Error('Telegram attachment size is invalid.');
  }
  return bytes;
}

function conversionText(value: unknown) {
  const results = Array.isArray(value) ? value : [value];
  return results
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const record = item as { data?: unknown; error?: unknown };
      if (record.error) return '';
      return typeof record.data === 'string' ? record.data.trim() : '';
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_EXTRACTED_CHARACTERS);
}

function transcriptionText(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text.trim();
  const info = record.transcription_info;
  if (info && typeof info === 'object' && typeof (info as { text?: unknown }).text === 'string') {
    return String((info as { text: string }).text).trim();
  }
  return '';
}

export async function resolveEnterpriseAiMediaContext(input: {
  tenantId: string;
  connectionId: string;
  channelKey?: EnterpriseAiChannelKey;
  attachments?: readonly EnterpriseAiInboundAttachment[];
}): Promise<EnterpriseAiMediaContext> {
  const attachments = (input.attachments ?? []).slice(0, MAX_MEDIA_ATTACHMENTS);
  if (!attachments.length) {
    return { text: '', imageInputs: 0, documentInputs: 0, audioSeconds: 0, providerCostUsdMicros: 0n };
  }
  if (input.channelKey !== 'telegram') {
    throw new Error('Media ingestion is not enabled for this Enterprise AI channel.');
  }

  const connection = await db.query.aiProviderConnections.findFirst({
    where: and(
      eq(aiProviderConnections.id, input.connectionId),
      eq(aiProviderConnections.tenantId, input.tenantId),
      eq(aiProviderConnections.providerKey, 'channel:telegram'),
      eq(aiProviderConnections.mode, 'channel'),
      eq(aiProviderConnections.status, 'active'),
    ),
  });
  if (!connection?.secretRef) throw new Error('Telegram media connection is unavailable.');
  const credentials = revealChannelCredentials(connection.secretRef);
  if (!credentials.botToken) throw new Error('Telegram bot token is not configured.');

  const ai = env.AI as unknown as WorkersAiMediaBinding;
  if (!ai?.run || !ai?.toMarkdown) throw new Error('Workers AI media processing is unavailable.');

  const sections: string[] = [];
  let imageInputs = 0;
  let documentInputs = 0;
  let audioSeconds = 0;
  let providerCostUsdMicros = 0n;

  for (const [index, attachment] of attachments.entries()) {
    if (!attachment.providerFileId) continue;
    if (attachment.sizeBytes && attachment.sizeBytes > MAX_MEDIA_BYTES) {
      throw new Error('Telegram attachment exceeds the Enterprise AI media size limit.');
    }
    const bytes = await loadTelegramFile(credentials.botToken, attachment);

    if (attachment.kind === 'audio') {
      const seconds = boundedPositiveInteger(attachment.durationSeconds, MAX_AUDIO_SECONDS);
      if (!seconds || Number(attachment.durationSeconds) > MAX_AUDIO_SECONDS) {
        throw new Error('Telegram voice note exceeds the Enterprise AI audio duration limit.');
      }
      const response = await ai.run('@cf/openai/whisper-large-v3-turbo', {
        audio: [...new Uint8Array(bytes)],
        task: 'transcribe',
        vad_filter: true,
      });
      const transcript = transcriptionText(response).slice(0, MAX_EXTRACTED_CHARACTERS);
      if (!transcript) throw new Error('Telegram voice note transcription returned no text.');
      audioSeconds += seconds;
      providerCostUsdMicros += ceilDiv(BigInt(seconds) * WHISPER_USD_MICROS_PER_MINUTE, 60n);
      sections.push(`[Voice note transcript ${index + 1}]\n${transcript}`);
      continue;
    }

    const mimeType = attachment.mimeType || (attachment.kind === 'image' ? 'image/jpeg' : 'application/octet-stream');
    const fileName = safeFileName(
      attachment,
      attachment.kind === 'image' ? `telegram-image-${index + 1}.jpg` : `telegram-document-${index + 1}`,
    );
    const converted = await ai.toMarkdown(
      { name: fileName, blob: new Blob([bytes], { type: mimeType }) },
      { conversionOptions: { output: { format: 'text' } } },
    );
    const extracted = conversionText(converted);
    if (!extracted) throw new Error('Telegram attachment conversion returned no usable text.');
    providerCostUsdMicros += VISUAL_CONVERSION_PROVIDER_COST_RESERVE_USD_MICROS;
    if (attachment.kind === 'image') imageInputs += 1;
    else documentInputs += 1;
    sections.push(
      attachment.kind === 'image'
        ? `[Attached image analysis ${index + 1}]\n${extracted}`
        : `[Attached document text ${index + 1}]\n${extracted}`,
    );
  }

  return {
    text: sections.join('\n\n').slice(0, MAX_EXTRACTED_CHARACTERS),
    imageInputs,
    documentInputs,
    audioSeconds,
    providerCostUsdMicros,
  };
}
