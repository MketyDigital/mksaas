import { and, eq, gt } from 'drizzle-orm';

import { buildFlutterwaveInlineConfig } from '@/features/payments/flutterwave-standard';
import { db } from '@/shared/db';
import { paymentCheckoutSessions } from '@/shared/db/schema';

export async function createFlutterwaveInlineSession(input: {
  source: 'saas' | 'media' | 'enterprise' | 'host';
  reference: string;
  canonicalAmountMinor: bigint;
  canonicalCurrency: 'USD';
  collectionAmountMinor: bigint;
  collectionCurrency: string;
  email: string;
  customerName?: string;
  redirectUrl: string;
  metadata: Record<string, unknown>;
  publicKey: string;
  secretKey: string;
  origin?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const inlineConfig = await buildFlutterwaveInlineConfig({
    publicKey: input.publicKey,
    secretKey: input.secretKey,
    source: input.source,
    reference: input.reference,
    amountMinor: input.collectionAmountMinor,
    currency: input.collectionCurrency,
    email: input.email,
    customerName: input.customerName,
    redirectUrl: input.redirectUrl,
    metadata: input.metadata,
  });

  const [session] = await db
    .insert(paymentCheckoutSessions)
    .values({
      provider: 'flutterwave',
      source: input.source,
      reference: input.reference,
      canonicalAmountMinor: input.canonicalAmountMinor.toString(),
      canonicalCurrency: input.canonicalCurrency,
      collectionAmountMinor: input.collectionAmountMinor.toString(),
      collectionCurrency: input.collectionCurrency,
      customerEmail: input.email,
      customerName: input.customerName ?? null,
      redirectUrl: input.redirectUrl,
      metadataJson: input.metadata,
      payloadHash: inlineConfig.payload_hash,
      status: 'created',
      expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [paymentCheckoutSessions.provider, paymentCheckoutSessions.reference],
      set: {
        canonicalAmountMinor: input.canonicalAmountMinor.toString(),
        canonicalCurrency: input.canonicalCurrency,
        collectionAmountMinor: input.collectionAmountMinor.toString(),
        collectionCurrency: input.collectionCurrency,
        customerEmail: input.email,
        customerName: input.customerName ?? null,
        redirectUrl: input.redirectUrl,
        metadataJson: input.metadata,
        payloadHash: inlineConfig.payload_hash,
        status: 'created',
        expiresAt,
        updatedAt: now,
      },
    })
    .returning({ id: paymentCheckoutSessions.id });

  const origin = input.origin ?? 'https://mkety.com';
  return {
    id: session.id,
    url: `${origin}/pay/flutterwave?session=${encodeURIComponent(session.id)}`,
    inlineConfig,
    expiresAt,
  };
}

export async function getFlutterwaveInlineSession(input: {
  sessionId: string;
  publicKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [session] = await db
    .select()
    .from(paymentCheckoutSessions)
    .where(
      and(
        eq(paymentCheckoutSessions.id, input.sessionId),
        eq(paymentCheckoutSessions.provider, 'flutterwave'),
        eq(paymentCheckoutSessions.status, 'created'),
        gt(paymentCheckoutSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) return null;

  return {
    session,
    inlineConfig: {
      public_key: input.publicKey,
      tx_ref: session.reference,
      amount: Number(BigInt(session.collectionAmountMinor)) / 100,
      currency: session.collectionCurrency,
      redirect_url: session.redirectUrl,
      customer: {
        email: session.customerEmail,
        ...(session.customerName ? { name: session.customerName } : {}),
      },
      customizations: {
        title: session.source === 'media' ? 'Mkety Media' : 'Mkety',
        description: 'Secure Mkety payment',
        logo: 'https://mkety.com/icon.png',
      },
      meta: session.metadataJson,
      payload_hash: session.payloadHash,
    },
  };
}
