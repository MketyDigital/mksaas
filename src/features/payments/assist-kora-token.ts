import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AssistKoraCheckoutToken {
  reference: string;
  amount: number;
  currency: 'USD';
  email: string;
  customerName: string;
  exp: number;
}

export function readAssistKoraCheckoutToken(payload: string, signature: string, secret: string): AssistKoraCheckoutToken | null {
  if (!payload || !signature || !secret) return null;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('base64url'));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AssistKoraCheckoutToken>;
    if (
      !value.reference ||
      !value.amount ||
      value.currency !== 'USD' ||
      !value.email ||
      !value.exp ||
      value.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      reference: value.reference,
      amount: Number(value.amount),
      currency: 'USD',
      email: value.email,
      customerName: value.customerName || value.email,
      exp: Number(value.exp),
    };
  } catch {
    return null;
  }
}
