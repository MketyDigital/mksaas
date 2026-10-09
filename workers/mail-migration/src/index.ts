// Cloudflare Workers provides this runtime module at deploy time.
// eslint-disable-next-line import/no-unresolved
import { connect } from 'cloudflare:sockets';
import { ImapSession, validateImapEndpoint } from './imap-session';

type MigrationCursor = Record<string, { uidValidity: string; lastUid: string }>;
type QueueBody = { runId: string };
type ClaimedRun = {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  sourceCursor: MigrationCursor;
};

type Env = {
  MKETY_MAIL_INTERNAL_SECRET: string;
  MKETY_MAIL_INTERNAL_API_URL: string;
  MAIL_MIGRATION_QUEUE: Queue<QueueBody>;
};

const MAX_MESSAGES_PER_INVOCATION = 100;
async function internalRequest(env: Env, path: string, init: RequestInit) {
  const base = env.MKETY_MAIL_INTERNAL_API_URL.replace(/\/$/, '');
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.MKETY_MAIL_INTERNAL_SECRET}`,
      ...(init.headers || {}),
    },
  });
}

async function updateProgress(
  env: Env,
  runId: string,
  status: string,
  sourceCursor?: MigrationCursor,
  safeErrorCode?: string,
) {
  const response = await internalRequest(env, '/api/internal/mail/migrations/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId, status, sourceCursor, safeErrorCode }),
  });
  if (!response.ok) throw new Error('migration_progress_update_failed');
}

async function claimRun(env: Env, runId: string): Promise<ClaimedRun | null> {
  const response = await internalRequest(env, '/api/internal/mail/migrations/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ runId }),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('migration_claim_failed');
  const payload = (await response.json()) as { run?: ClaimedRun };
  if (!payload.run?.id || payload.run.id !== runId) throw new Error('migration_claim_invalid');
  payload.run.host = validateImapEndpoint(payload.run.host, payload.run.port);
  return payload.run;
}

async function importMessage(
  env: Env,
  runId: string,
  message: Awaited<ReturnType<ImapSession['fetchMessage']>>,
  specialUse: string[],
) {
  const headers = new Headers({
    'content-type': 'message/rfc822',
    'x-mkety-source-folder': message.folderPath,
    'x-mkety-source-uid': message.uid,
    'x-mkety-source-uidvalidity': message.uidValidity,
    'x-mkety-source-flags': JSON.stringify(message.flags),
    'x-mkety-source-special-use': JSON.stringify(specialUse),
  });
  const response = await internalRequest(
    env,
    `/api/internal/mail/migrations/message?runId=${encodeURIComponent(runId)}`,
    {
      method: 'POST',
      headers,
      body: message.raw.slice().buffer,
    },
  );
  if (!response.ok) throw new Error('migration_message_import_failed');
}

async function processRun(env: Env, runId: string) {
  const run = await claimRun(env, runId);
  if (!run) return;
  const socket = connect({ hostname: run.host, port: 993 }, { secureTransport: 'on', allowHalfOpen: false });
  const session = new ImapSession(socket);
  let finished = false;
  let imported = 0;
  const cursor: MigrationCursor = { ...run.sourceCursor };
  try {
    await session.greeting();
    await session.capability();
    await session.login(run.username, run.password);
    const folders = await session.listFolders();
    for (const folder of folders) {
      const { uidValidity, uidNext } = await session.examine(folder.path);
      const prior = cursor[folder.path];
      const lastUid = prior?.uidValidity === uidValidity ? BigInt(prior.lastUid || '0') : 0n;
      const uidNextNumber = BigInt(uidNext);
      const endUid = uidNextNumber > 0n ? uidNextNumber - 1n : 0n;
      let rangeStart = lastUid + 1n;
      while (rangeStart <= endUid) {
        const rangeEnd = rangeStart + 499n < endUid ? rangeStart + 499n : endUid;
        const uids = await session.searchUidRange(String(rangeStart), String(rangeEnd));
        for (const uid of uids) {
          const fetched = await session.fetchMessage(uid, folder.path, uidValidity);
          await importMessage(env, runId, fetched, folder.specialUse);
          cursor[folder.path] = { uidValidity, lastUid: uid };
          await updateProgress(env, runId, 'running', cursor);
          imported += 1;
          if (imported >= MAX_MESSAGES_PER_INVOCATION) {
            await session.logout();
            await env.MAIL_MIGRATION_QUEUE.send({ runId });
            finished = true;
            return;
          }
        }
        rangeStart = rangeEnd + 1n;
      }
      cursor[folder.path] = { uidValidity, lastUid: String(endUid) };
      await updateProgress(env, runId, 'running', cursor);
    }
    await session.logout();
    finished = true;
    await updateProgress(env, runId, 'completed', cursor);
  } catch (error) {
    const code =
      error instanceof Error && /^imap_[a-z_]+$/.test(error.message) ? error.message : 'imap_migration_failed';
    if (code === 'imap_login_failed' || code === 'imap_endpoint_disallowed' || code === 'imap_endpoint_invalid') {
      await updateProgress(env, runId, 'failed', cursor, code);
      finished = true;
    }
    throw error;
  } finally {
    if (!finished) await session.close();
  }
}

export default {
  async queue(batch: MessageBatch<QueueBody>, env: Env) {
    for (const message of batch.messages) {
      const runId = typeof message.body?.runId === 'string' ? message.body.runId : '';
      if (!/^[0-9a-f-]{36}$/i.test(runId)) {
        message.ack();
        continue;
      }
      try {
        await processRun(env, runId);
        message.ack();
      } catch {
        if (message.attempts >= 5) {
          await updateProgress(env, runId, 'failed', undefined, 'imap_migration_retry_limit');
          message.ack();
        } else {
          message.retry({ delaySeconds: Math.min(60, 2 ** message.attempts) });
        }
      }
    }
  },
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env, QueueBody>;
