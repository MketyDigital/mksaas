# Mail production/gateway release marker — 2026-09-30

This neutral marker intentionally activates the guarded exact-SHA Mkety Mail Production and Mail Gateway Production workflows after the final platform-completion audit.

Merged main implementation SHA before this marker: `dac5e70f8c076a324aca5210b84c41358025f722`.

External-client UI must remain fail-closed until the gateway functional acceptance proves real IMAP/SMTP app-password authentication, mailbox behavior, controlled send behavior, revocation failure, and fixture cleanup.
