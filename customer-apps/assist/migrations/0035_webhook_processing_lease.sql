ALTER TABLE webhook_events ADD COLUMN processing_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_lease
  ON webhook_events(status,processing_at);
