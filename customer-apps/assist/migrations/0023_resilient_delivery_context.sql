ALTER TABLE assistants ADD COLUMN human_delay_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assistants ADD COLUMN human_delay_min_seconds INTEGER NOT NULL DEFAULT 3;
ALTER TABLE assistants ADD COLUMN human_delay_max_seconds INTEGER NOT NULL DEFAULT 12;
ALTER TABLE assistants ADD COLUMN human_delay_per_char_ms INTEGER NOT NULL DEFAULT 10;
ALTER TABLE assistants ADD COLUMN context_recent_message_limit INTEGER NOT NULL DEFAULT 12;
ALTER TABLE assistants ADD COLUMN context_knowledge_char_budget INTEGER NOT NULL DEFAULT 12000;
ALTER TABLE assistants ADD COLUMN context_memory_char_budget INTEGER NOT NULL DEFAULT 4000;

CREATE TABLE IF NOT EXISTS reply_jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_conversation_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  sender_id TEXT,
  user_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  user_text TEXT,
  media_context TEXT,
  image_count INTEGER NOT NULL DEFAULT 0,
  audio_seconds REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','delivered','failed','superseded','cancelled')),
  due_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 20,
  last_error TEXT,
  response_text TEXT,
  external_delivery_id TEXT,
  last_enqueued_at INTEGER,
  locked_at INTEGER,
  delivery_started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id,channel,provider_message_id)
);
CREATE INDEX IF NOT EXISTS idx_reply_jobs_due ON reply_jobs(status,due_at);
CREATE INDEX IF NOT EXISTS idx_reply_jobs_conversation ON reply_jobs(conversation_id,created_at);

CREATE TABLE IF NOT EXISTS model_runtime_limits (
  scope_key TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  requests_per_second INTEGER,
  requests_per_minute INTEGER,
  tokens_per_minute INTEGER,
  retry_base_seconds INTEGER NOT NULL DEFAULT 2,
  retry_max_seconds INTEGER NOT NULL DEFAULT 120,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_runtime_limits_lookup ON model_runtime_limits(customer_id,alias);

CREATE TABLE IF NOT EXISTS model_rate_windows (
  scope_key TEXT PRIMARY KEY,
  second_bucket INTEGER NOT NULL,
  second_count INTEGER NOT NULL DEFAULT 0,
  minute_bucket INTEGER NOT NULL,
  minute_count INTEGER NOT NULL DEFAULT 0,
  minute_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_cache (
  cache_key TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value_text TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_expiry ON prompt_cache(expires_at);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(item_id,ordinal)
);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_item ON knowledge_chunks(item_id,ordinal);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_collection ON knowledge_chunks(collection_id,item_id);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  title,
  content,
  tokenize='unicode61'
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  through_message_created_at INTEGER NOT NULL DEFAULT 0,
  source_message_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_context ON messages(conversation_id,created_at DESC);
