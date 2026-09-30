import { Buffer } from 'node:buffer';
import { env } from 'cloudflare:workers';

import type { EnterpriseAiChannelCredentials } from './credentials';
import type { EnterpriseAiInboundMedia } from './inbound';
import type { EnterpriseAiChannelKey } from './registry';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 10 * 60;
const VISION_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const TRANSCRIPTION_MODEL = '@cf/openai/whisper-large-v3-turbo';

// Conservative internal provider-cost estimates. These are never customer-facing prices.
const VISION_ESTIMATE_USD_MICROS = 2_500n;
const WHISPER_USD_MICROS_PER_MINUTE = 513n;

type WorkersAiBinding = {
  run(model: string, input: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
};

type ResolvedTelegramFile = {
  bytes: Uint8Array;
  contentType: string;
};

function aiBinding(): WorkersAiBinding {
  const binding = env.AI as unknown as WorkersAiBinding | undefined;
  if (!binding?.run) throw new Error('Workers AI binding is unavailable for media processing.');
  return binding;
}

function workersAiOptions() {
  const gatewayId = typeof env.MKETY_AI_GATEWAY_ID === 'string' ? env.MKETY_AI_GATEWAY_ID.trim() : '';
  return gatewayId
    ? { rejectIfBusy: true, gateway: { id: gatewayId, skipCache: true } }
    : { rejectIfBusy: true };
}

function safeMediaCount(media: readonly EnterpriseAiInboundMedia[]) {
  if (media.length > 3) throw new Error('Too many media attachments.');
}

function estimateAudioCost(durationSeconds?: number) {
  const seconds = Math.max(1, Math.min(MAX_AUDIO_SECONDS, Math.ceil(durationSeconds ?? 60)));
  return (WHISPER_USD_MICROS_PER_MINUTE * BigInt(seconds) + 59n) / 60n;
}

export function estimateEnterpriseAiInboundMediaCostUsdMicros(
  media: readonly EnterpriseAiInboundMedia[] = [],
) {
  safeMediaCount(media);
  return media.reduce((total, item) => (
    total + (item.kind === 'image' ? VISION_ESTIMATE_USD_MICROS : estimateAudioCost(item.durationSeconds))
  ), 0n);
}

function telegramPlaceholder(item: EnterpriseAiInboundMedia) {
  if (item.kind === 'image') return '[Image attachment]';
  return item.durationSeconds ? `[Voice/audio attachment · ${Math.ceil(item.durationSeconds)}s]` : '[Voice/audio attachment]';
}

export function enterpriseAiInboundMediaPlaceholder(
  media: readonly EnterpriseAiInboundMedia[] = [],
) {
  safeMediaCount(media);
  return media.map(telegramPlaceholder).join(' ');
}

async function resolveTelegramFile(
  item: EnterpriseAiInboundMedia,
  credentials: EnterpriseAiChannelCredentials,
): Promise<ResolvedTelegramFile> {
  const botToken = credentials.botToken;
  if (!botToken) throw new Error('Telegram bot token is not configured.');

  const infoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: item.providerFileId }),
  });
  const info = await infoResponse.json().catch(() => null) as {
    ok?: boolean;
    result?: { file_path?: string; file_size?: number };
  } | null;
  const filePath = String(info?.result?.file_path ?? '');
  const reportedSize = Number(info?.result?.file_size ?? item.sizeBytes ?? 0);
  const maxBytes = item.kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (!infoResponse.ok || info?.ok !== true || !filePath || filePath.includes('..')) {
    throw new Error('Telegram media file could not be resolved.');
  }
  if (reportedSize > maxBytes) throw new Error('Telegram media file is too large.');

  const fileResponse = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`, {
    redirect: 'follow',
  });
  if (!fileResponse.ok) throw new Error('Telegram media file could not be downloaded.');
  const contentLength = Number(fileResponse.headers.get('content-length') ?? '0');
  if (contentLength > maxBytes) throw new Error('Telegram media file is too large.');

  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  if (!bytes.length || bytes.length > maxBytes) throw new Error('Telegram media file is invalid.');

  const headerType = (fileResponse.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const contentType = headerType || item.mimeType || (item.kind === 'image' ? 'image/jpeg' : 'audio/ogg');
  if (item.kind === 'image' && !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Telegram image type is not supported.');
  }
  if (item.kind === 'audio' && !['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/wav', 'audio/x-wav'].includes(contentType)) {
    throw new Error('Telegram audio type is not supported.');
  }
  return { bytes, contentType };
}

function resultText(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.response === 'string') return record.response.trim();
  if (typeof record.text === 'string') return record.text.trim();
  const nested = record.result;
  if (nested && typeof nested === 'object') {
    const result = nested as Record<string, unknown>;
    if (typeof result.response === 'string') return result.response.trim();
    if (typeof result.text === 'string') return result.text.trim();
  }
  return '';
}

async function describeImage(file: ResolvedTelegramFile) {
  const base64 = Buffer.from(file.bytes).toString('base64');
  const result = await aiBinding().run(
    VISION_MODEL,
    {
      messages: [{
        role: 'user',
        content: 'Describe this image accurately for another assistant. Include visible text, important objects, people/actions, layout, and details relevant to answering a user question. Do not invent hidden facts.',
      }],
      image: `data:${file.contentType};base64,${base64}`,
      max_tokens: 600,
    },
    workersAiOptions(),
  );
  const text = resultText(result);
  if (!text) throw new Error('Image understanding returned no usable description.');
  return text.slice(0, 8_000);
}

async function transcribeAudio(file: ResolvedTelegramFile) {
  const base64 = Buffer.from(file.bytes).toString('base64');
  const result = await aiBinding().run(
    TRANSCRIPTION_MODEL,
    { audio: base64, task: 'transcribe', vad_filter: true },
    workersAiOptions(),
  );
  const text = resultText(result);
  if (!text) throw new Error('Voice/audio transcription returned no usable text.');
  return text.slice(0, 12_000);
}

export type ResolvedEnterpriseAiInboundMedia = {
  contextText: string;
  transcriptText: string;
  providerCostUsdMicros: bigint;
  processed: Array<{ kind: 'image' | 'audio'; model: string }>;
};

export async function resolveEnterpriseAiInboundMedia(input: {
  channel: EnterpriseAiChannelKey;
  media?: readonly EnterpriseAiInboundMedia[];
  credentials?: EnterpriseAiChannelCredentials;
}): Promise<ResolvedEnterpriseAiInboundMedia> {
  const media = input.media ?? [];
  if (!media.length) {
    return { contextText: '', transcriptText: '', providerCostUsdMicros: 0n, processed: [] };
  }
  safeMediaCount(media);
  if (input.channel !== 'telegram') throw new Error('Inbound media is not implemented for this channel yet.');
  if (!input.credentials) throw new Error('Channel credentials are required for inbound media.');

  const context: string[] = [];
  const transcripts: string[] = [];
  const processed: Array<{ kind: 'image' | 'audio'; model: string }> = [];
  for (const item of media) {
    if (item.kind === 'audio' && (item.durationSeconds ?? 0) > MAX_AUDIO_SECONDS) {
      throw new Error('Voice/audio attachment is too long.');
    }
    const file = await resolveTelegramFile(item, input.credentials);
    if (item.kind === 'image') {
      const description = await describeImage(file);
      context.push(`Image analysis: ${description}`);
      processed.push({ kind: 'image', model: VISION_MODEL });
    } else {
      const transcript = await transcribeAudio(file);
      transcripts.push(transcript);
      context.push(`Voice/audio transcript: ${transcript}`);
      processed.push({ kind: 'audio', model: TRANSCRIPTION_MODEL });
    }
  }

  return {
    contextText: context.join('\n\n').slice(0, 24_000),
    transcriptText: transcripts.join('\n').slice(0, 16_000),
    providerCostUsdMicros: estimateEnterpriseAiInboundMediaCostUsdMicros(media),
    processed,
  };
}
