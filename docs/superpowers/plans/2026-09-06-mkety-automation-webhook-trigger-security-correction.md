# Mkety Automation Webhook Trigger Security Correction

This addendum supersedes every `secretHash`, `persist only a hash/digest`, and equivalent hash-only signing-secret instruction in `2026-09-06-mkety-automation-webhook-trigger-foundation.md`.

## Corrected requirement

HMAC-SHA256 verification requires the server to possess the original signing key. A one-way hash of the signing secret cannot be used to recompute the expected HMAC and therefore cannot satisfy the approved webhook authentication contract.

The implementation must instead:

- generate the raw webhook signing secret cryptographically;
- return it to an authorized manager only at endpoint creation or secret rotation;
- never persist the raw secret in plaintext;
- encrypt the signing secret at rest with AES-256-GCM;
- obtain the encryption key from server-managed `WEBHOOK_SECRET_ENCRYPTION_KEY`;
- require that encryption key to decode to exactly 32 bytes;
- fail closed when the key is absent/malformed or ciphertext cannot authenticate/decrypt;
- store a SHA-256 secret fingerprint only as non-secret operational metadata;
- never use the fingerprint as an HMAC verification key;
- keep ciphertext, fingerprint, raw secret and encryption key out of ordinary endpoint reads and public responses.

The corrected design specification at `docs/superpowers/specs/2026-09-06-mkety-automation-webhook-trigger-foundation-design.md` is authoritative for the completed phase.
