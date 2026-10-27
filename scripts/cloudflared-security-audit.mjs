import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const API_ROOT = 'https://api.cloudflare.com/client/v4';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const MINIMUM_VERSION = [2026, 10, 2];
const MACOS_REVIEW_VERSION = [2026, 10, 3];
const UUID_PATTERN = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

function parseRelease(version) {
  const match = String(version ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareRelease(left, right) {
  for (let index = 0; index < right.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

export function assessConnectorVersion(version, architecture) {
  const release = parseRelease(version);
  if (!release) return 'unknown';
  if (compareRelease(release, MINIMUM_VERSION) < 0) return 'upgrade_required';
  if (/darwin|macos/i.test(String(architecture ?? '')) && compareRelease(release, MACOS_REVIEW_VERSION) < 0) {
    return 'macos_install_method_review';
  }
  return 'patched';
}

export function requiresFollowUp(assessment) {
  return [
    'upgrade_required',
    'unknown',
    'macos_install_method_review',
    'no_active_connectors',
  ].includes(assessment);
}

function safeText(value, fallback) {
  const text = typeof value === 'string' ? value : fallback;
  return text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 128) || fallback;
}

export async function fetchTunnelAudit({ accountId, apiToken, fetcher = globalThis.fetch }) {
  if (!/^[a-f\d]{32}$/i.test(String(accountId ?? ''))) throw new Error('Cloudflare account ID is missing or invalid');
  if (typeof apiToken !== 'string' || apiToken.trim().length === 0) throw new Error('Cloudflare API token is missing');
  if (typeof fetcher !== 'function') throw new Error('Cloudflare API fetch is unavailable');

  const request = async (path) => {
    let response;
    try {
      response = await fetcher(`${API_ROOT}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
      });
    } catch {
      throw new Error('Cloudflare API read failed before a response was received');
    }

    if (!response.ok) throw new Error(`Cloudflare API request failed (${response.status})`);
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Cloudflare API returned invalid JSON');
    }
    if (payload?.success !== true || !Array.isArray(payload.result)) {
      throw new Error(`Cloudflare API request failed (${response.status})`);
    }
    return payload;
  };

  const getAllPages = async (path) => {
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const separator = path.includes('?') ? '&' : '?';
      const payload = await request(`${path}${separator}per_page=${PAGE_SIZE}&page=${page}`);
      rows.push(...payload.result);
      const rawTotalCount = payload.result_info?.total_count;
      const totalCount = typeof rawTotalCount === 'number'
        ? rawTotalCount
        : typeof rawTotalCount === 'string' && rawTotalCount.trim().length > 0
          ? Number(rawTotalCount)
          : Number.NaN;
      if (Number.isInteger(totalCount) && totalCount >= 0) {
        if (rows.length > totalCount) throw new Error('Cloudflare API returned inconsistent pagination metadata');
        if (rows.length === totalCount) return rows;
        if (payload.result.length === 0) throw new Error('Cloudflare API pagination ended before all records were returned');
      } else if (payload.result.length === 0) {
        return rows;
      }
    }
    throw new Error('Cloudflare API pagination exceeded the safe page limit');
  };

  const accountPath = `/accounts/${accountId}`;
  const tunnels = await getAllPages(`${accountPath}/cfd_tunnel?is_deleted=false`);
  const audit = [];

  for (const tunnel of tunnels) {
    if (typeof tunnel?.id !== 'string' || !UUID_PATTERN.test(tunnel.id)) {
      throw new Error('Cloudflare returned a tunnel with an invalid identifier');
    }

    const clients = await getAllPages(`${accountPath}/cfd_tunnel/${tunnel.id}/connections`);
    const assessedClients = clients.map((client) => {
      const versions = [...new Set([
        client?.version,
        ...(Array.isArray(client?.conns) ? client.conns.map((connection) => connection?.client_version) : []),
      ].filter((version) => typeof version === 'string' && version.length > 0))].sort();
      const architecture = safeText(client?.arch, 'unknown');
      const assessments = versions.map((version) => assessConnectorVersion(version, architecture));
      const assessment = assessments.length === 0
        ? 'unknown'
        : assessments.includes('upgrade_required')
          ? 'upgrade_required'
          : assessments.includes('unknown')
            ? 'unknown'
            : assessments.includes('macos_install_method_review')
              ? 'macos_install_method_review'
              : 'patched';

      return { architecture, versions, assessment };
    });

    const clientAssessments = assessedClients.map((client) => client.assessment);
    const assessment = assessedClients.length === 0
      ? 'no_active_connectors'
      : clientAssessments.includes('upgrade_required')
        ? 'upgrade_required'
        : clientAssessments.includes('unknown')
          ? 'unknown'
          : clientAssessments.includes('macos_install_method_review')
            ? 'macos_install_method_review'
            : 'patched';

    audit.push({
      name: safeText(tunnel?.name, 'unnamed-tunnel'),
      status: safeText(tunnel?.status, 'unknown'),
      assessment,
      connectorCount: clients.length,
      connectionCount: clients.reduce((total, client) => total + (Array.isArray(client?.conns) ? client.conns.length : 0), 0),
      clients: assessedClients,
    });
  }

  return audit;
}

async function main() {
  const audit = await fetchTunnelAudit({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  });
  console.log(`CLOUDFLARED_CONNECTOR_AUDIT ${JSON.stringify(audit)}`);

  const needsReview = audit.length === 0 || audit.some(({ assessment }) => requiresFollowUp(assessment));
  if (needsReview) {
    console.error(audit.length === 0
      ? 'No tunnels were returned; verify the Cloudflare account and API token scope.'
      : 'At least one tunnel needs an upgrade, version review, or offline-host check.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Cloudflared security audit failed safely');
    process.exitCode = 1;
  });
}
