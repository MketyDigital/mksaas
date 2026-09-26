# Mkety Brevo Email Configuration

Mkety uses one Brevo account in two independent delivery paths.

## ZITADEL authentication email

ZITADEL owns signup verification, OTP, initialization and identity-recovery email delivery.

Repository secrets:

- `BREVO_SMTP_LOGIN` — Brevo SMTP login.
- `BREVO_SMTP_KEY` — Brevo SMTP key/password. Do not use the Brevo API key here.
- `BREVO_SENDER_EMAIL` — verified Brevo sender address.
- `BREVO_SENDER_NAME` — optional; defaults to `Mkety`.
- `BREVO_REPLY_TO_EMAIL` — optional; recommended `support@mkety.com`.

SMTP host defaults to `smtp-relay.brevo.com:587`.

The workflow `Mkety ZITADEL Auth and Brevo Email Reconcile` tests the SMTP configuration through ZITADEL before creating/updating and activating the `Mkety Brevo SMTP` provider.

## Mkety application email

Mkety application/support transactional email uses Brevo's HTTPS API from the server runtime.

Repository secrets:

- `BREVO_API_KEY` — Brevo API key.
- `BREVO_SENDER_EMAIL` — same verified sender used by ZITADEL is acceptable.
- `BREVO_SENDER_NAME` — optional; defaults to `Mkety`.
- `BREVO_REPLY_TO_EMAIL` — optional; recommended `support@mkety.com`.

The application sends through `POST https://api.brevo.com/v3/smtp/email`. Provider secrets remain server-side.

Initial wired application use:
- tenant invitation creation;
- tenant invitation resend.

Invitation persistence is not rolled back when provider delivery fails. The invite remains valid and the existing invite URL remains available to an authorized tenant administrator.

## Recommended sender

Use a verified Mkety sender such as:

`notifications@mkety.com`

or:

`no-reply@mkety.com`

Set `BREVO_REPLY_TO_EMAIL=support@mkety.com` so customer replies reach support.

## Security boundary

- Never place Brevo API or SMTP keys in client-side variables.
- ZITADEL receives only SMTP credentials.
- Mkety application runtime receives only the Brevo HTTP API key and sender metadata.
- The same Brevo account/sender can be shared while credentials remain purpose-separated.
