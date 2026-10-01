ALTER TABLE customer_api_keys ADD COLUMN scopes_json TEXT NOT NULL DEFAULT '["inference"]';
ALTER TABLE customer_api_keys ADD COLUMN rate_limit_per_minute INTEGER NOT NULL DEFAULT 60;
ALTER TABLE knowledge_items ADD COLUMN error_code TEXT;
ALTER TABLE knowledge_items ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE conversations ADD COLUMN memory_cleared_at INTEGER;
