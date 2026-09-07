import type { NormalizedSettlement, SettlementSource } from '../domain/settlement';
import type { VerifiedGatewayEvent } from './types';

interface SettlementPayloadFields {
  eventId: string;
  paymentId: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currencyExpected: string;
  amountPaidMinor: bigint;
  currencyPaid: string;
  occurredAt: Date;
}

function requireRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Gateway settlement payload must be an object.');
  }
  return payload as Record<string, unknown>;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Gateway settlement payload requires ${key}.`);
  }
  return value;
}

function requireMinorUnits(payload: Record<string, unknown>, key: string): bigint {
  const value = requireString(payload, key);
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Gateway settlement ${key} must be integer minor units.`);
  }
  return BigInt(value);
}

export function parseVerifiedSettlementFields(event: VerifiedGatewayEvent): {
  payload: Record<string, unknown>;
  fields: SettlementPayloadFields;
} {
  const payload = requireRecord(event.payload);
  if (payload.verified !== true) {
    throw new Error('Gateway settlement event must be verified before normalization.');
  }

  const occurredAt = new Date(requireString(payload, 'occurredAt'));
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('Gateway settlement occurredAt must be a valid timestamp.');
  }

  return {
    payload,
    fields: {
      eventId: requireString(payload, 'eventId'),
      paymentId: requireString(payload, 'paymentId'),
      subscriptionId: requireString(payload, 'subscriptionId'),
      billingPeriodId: requireString(payload, 'billingPeriodId'),
      amountExpectedMinor: requireMinorUnits(payload, 'amountExpectedMinor'),
      currencyExpected: requireString(payload, 'currencyExpected'),
      amountPaidMinor: requireMinorUnits(payload, 'amountPaidMinor'),
      currencyPaid: requireString(payload, 'currencyPaid'),
      occurredAt,
    },
  };
}

export function toNormalizedSettlement(
  provider: SettlementSource,
  event: VerifiedGatewayEvent,
  fields: SettlementPayloadFields,
): NormalizedSettlement {
  return {
    provider,
    providerPaymentId: fields.paymentId,
    providerEventId: fields.eventId,
    subscriptionId: fields.subscriptionId,
    billingPeriodId: fields.billingPeriodId,
    amountExpectedMinor: fields.amountExpectedMinor,
    currencyExpected: fields.currencyExpected,
    amountPaidMinor: fields.amountPaidMinor,
    currencyPaid: fields.currencyPaid,
    status: 'verified_success',
    occurredAt: fields.occurredAt,
    rawReference: event.rawReference,
  };
}
