CREATE SCHEMA IF NOT EXISTS "saas_template";

CREATE TABLE IF NOT EXISTS "saas_template"."public_ai_visitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "public_ai_visitors_last_seen_idx"
  ON "saas_template"."public_ai_visitors" ("last_seen_at");

CREATE TABLE IF NOT EXISTS "saas_template"."public_ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "visitor_id" uuid NOT NULL,
  "title" text DEFAULT 'Mkety AI' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz,
  CONSTRAINT "public_ai_conversations_visitor_id_public_ai_visitors_id_fk"
    FOREIGN KEY ("visitor_id") REFERENCES "saas_template"."public_ai_visitors"("id")
    ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "public_ai_conversations_visitor_idx"
  ON "saas_template"."public_ai_conversations" ("visitor_id");
CREATE INDEX IF NOT EXISTS "public_ai_conversations_updated_idx"
  ON "saas_template"."public_ai_conversations" ("updated_at");

CREATE TABLE IF NOT EXISTS "saas_template"."public_ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "public_ai_messages_conversation_id_public_ai_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "saas_template"."public_ai_conversations"("id")
    ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "public_ai_messages_conversation_idx"
  ON "saas_template"."public_ai_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "public_ai_messages_created_idx"
  ON "saas_template"."public_ai_messages" ("created_at");

CREATE TABLE IF NOT EXISTS "saas_template"."public_ai_memory_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "visitor_id" uuid NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz,
  CONSTRAINT "public_ai_memory_facts_visitor_id_public_ai_visitors_id_fk"
    FOREIGN KEY ("visitor_id") REFERENCES "saas_template"."public_ai_visitors"("id")
    ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "public_ai_memory_facts_visitor_idx"
  ON "saas_template"."public_ai_memory_facts" ("visitor_id");
CREATE INDEX IF NOT EXISTS "public_ai_memory_facts_key_idx"
  ON "saas_template"."public_ai_memory_facts" ("key");

CREATE TABLE IF NOT EXISTS "saas_template"."public_ai_tool_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "tool_name" text NOT NULL,
  "status" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "public_ai_tool_runs_conversation_id_public_ai_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "saas_template"."public_ai_conversations"("id")
    ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "public_ai_tool_runs_conversation_idx"
  ON "saas_template"."public_ai_tool_runs" ("conversation_id");
CREATE INDEX IF NOT EXISTS "public_ai_tool_runs_tool_idx"
  ON "saas_template"."public_ai_tool_runs" ("tool_name");
