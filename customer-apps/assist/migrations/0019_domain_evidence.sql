ALTER TABLE customer_domains ADD COLUMN public_dns_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_domains ADD COLUMN public_tls_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_domains ADD COLUMN ownership_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_domains ADD COLUMN public_checked_at INTEGER;
ALTER TABLE customer_domains ADD COLUMN provider_status TEXT;
