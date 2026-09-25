function timingSafeEqualText(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function verifyFlutterwaveV3WebhookSecret(input: {
  signature: string | null;
  secretHash: string;
}): void {
  if (!input.signature || !timingSafeEqualText(input.signature, input.secretHash)) {
    throw new Error('Invalid Flutterwave v3 webhook signature.');
  }
}

export async function retrieveFlutterwaveV3Transaction(input: {
  transactionId: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(input.transactionId)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    status?: string;
    data?: Record<string, unknown>;
  } | null;
  if (!response.ok || payload?.status !== 'success' || !payload.data) {
    throw new Error('Flutterwave v3 transaction verification failed.');
  }
  return payload.data;
}
