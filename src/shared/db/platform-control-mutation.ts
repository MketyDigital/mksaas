import { redirect } from 'next/navigation';

import { withServerActionDatabase } from './server-action';

function safeAdminMutationMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const message = raw.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database]')
    .replace(/(token|secret|password|api[-_ ]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .trim()
    .slice(0, 240);

  if (
    /postgres|hyperdrive|sqlstate|relation |column |database|socket|econn|connection|prepared statement|transaction/i.test(message)
  ) {
    return 'The database operation failed. No unsafe details were exposed. Please retry once; if it persists, use the admin action reference shown here.';
  }

  return message || 'The admin operation failed.';
}

function standalonePlatformControlPath(path: string) {
  const match = path.match(/^\/t\/([^/]+)\/admin\/platform-control(\/.*)?$/);
  if (!match) return path;
  return `/ops/${match[1]}/platform-control${match[2] ?? ''}`;
}

function withQuery(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${path}?${query.toString()}`;
}

/**
 * Platform Control mutations use POST/Redirect/GET instead of returning into
 * the Server Action RSC refresh stream. This guarantees the post-mutation
 * admin render starts as a fresh request with a fresh request-scoped DB.
 */
export async function runPlatformControlMutation(input: {
  path: string;
  action: string;
  work: () => Promise<void>;
}): Promise<never> {
  try {
    await withServerActionDatabase(input.work);
  } catch (error) {
    console.error(`[platform-control:${input.action}]`, error);
    redirect(withQuery(standalonePlatformControlPath(input.path), {
      adminStatus: 'error',
      adminAction: input.action,
      adminMessage: safeAdminMutationMessage(error),
    }));
  }

  redirect(withQuery(standalonePlatformControlPath(input.path), {
    adminStatus: 'saved',
    adminAction: input.action,
  }));
}
