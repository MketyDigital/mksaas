export function conservativeInputTokenUpperBound(rawRequestBytes: number) {
  if (!Number.isInteger(rawRequestBytes) || rawRequestBytes < 1) {
    throw new Error('Request bytes must be a positive integer.');
  }

  // Provider-specific message/tool formatting can add tokens that are not present
  // verbatim in the request JSON. Reserve 2x request bytes plus fixed protocol
  // overhead until a model-specific tokenizer is part of the route contract.
  return BigInt(rawRequestBytes) * 2n + 4_096n;
}
