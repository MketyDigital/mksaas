/** @jest-environment node */

import { createHmac } from 'node:crypto';

import { createMketyPaymentAttestation, verifyMketyPaymentAttestation } from './attestation';

describe('Mkety payment attestation', () => {
  it('matches the Media contract: Base64 HMAC-SHA256 over the unchanged raw body', async () => {
    const rawBody = '{"event":"charge.completed","data":{"id":991}}';
    const secret = 'shared-broker-secret-12345678901234567890';

    await expect(createMketyPaymentAttestation(rawBody, secret)).resolves.toBe(
      createHmac('sha256', secret).update(rawBody).digest('base64'),
    );
  });

  it('verifies only the unchanged raw body', async () => {
    const secret = 'shared-broker-secret-12345678901234567890';
    const rawBody = '{"event":"charge.completed","data":{"id":991}}';
    const signature = await createMketyPaymentAttestation(rawBody, secret);

    await expect(verifyMketyPaymentAttestation(rawBody, signature, secret)).resolves.toBe(true);
    await expect(verifyMketyPaymentAttestation(rawBody + ' ', signature, secret)).resolves.toBe(false);
  });
});
