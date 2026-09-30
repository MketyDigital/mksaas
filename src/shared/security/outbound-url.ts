const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home',
  '.lan',
  '.test',
  '.invalid',
  '.example',
];

function ipv4Octets(hostname: string) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return null;
  const values = match.slice(1).map(Number);
  return values.every((value) => value >= 0 && value <= 255) ? values : null;
}

function isBlockedIpv4(hostname: string) {
  const octets = ipv4Octets(hostname);
  if (!octets) return false;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isBlockedIpv6(hostname: string) {
  const normalized = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!normalized.includes(':')) return false;
  return (
    normalized === '::1' ||
    normalized === '::' ||
    // URL canonicalizes mapped IPv4 literals into hexadecimal IPv6. Reject
    // this alternate address form so private IPv4 cannot bypass the checks.
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('ff')
  );
}

export function assertPublicHostname(hostnameValue: string, label = 'Outbound hostname') {
  const hostname = hostnameValue.trim().toLowerCase().replace(/\.$/, '');
  if (!hostname) throw new Error(label + ' is required.');
  if (
    hostname === 'localhost' ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254' ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    isBlockedIpv4(hostname) ||
    isBlockedIpv6(hostname)
  ) {
    throw new Error(label + ' must resolve to a public internet host.');
  }
  return hostname;
}

export function assertPublicHttpsUrl(
  value: string,
  options: {
    label?: string;
    allowedHosts?: string[];
    allowedSuffixes?: string[];
  } = {},
) {
  const label = options.label ?? 'Outbound URL';
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error(label + ' must use HTTPS.');
  if (url.username || url.password) throw new Error(label + ' must not contain URL credentials.');
  if (url.port && url.port !== '443') throw new Error(label + ' must use the standard HTTPS port.');
  const hostname = assertPublicHostname(url.hostname, label);

  const allowedHosts = options.allowedHosts?.map((host) => host.toLowerCase()) ?? [];
  const allowedSuffixes = options.allowedSuffixes?.map((suffix) => suffix.toLowerCase()) ?? [];
  if (
    (allowedHosts.length || allowedSuffixes.length) &&
    !allowedHosts.includes(hostname) &&
    !allowedSuffixes.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error(label + ' host is not an approved provider endpoint.');
  }

  return url;
}
