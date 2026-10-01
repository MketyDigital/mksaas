const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

export function validateToolEndpoint(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("tool_endpoint_https_required");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "[::1]") {
    throw new Error("tool_endpoint_private_host");
  }
  if (PRIVATE_V4.some((r) => r.test(host)) || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) {
    throw new Error("tool_endpoint_private_host");
  }
  return url;
}

export function clampToolResponse(value: string, maxBytes = 64 * 1024) {
  const bytes = new TextEncoder().encode(value);
  if (bytes.byteLength <= maxBytes) return value;
  return new TextDecoder().decode(bytes.slice(0, maxBytes));
}
