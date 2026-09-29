CREATE TABLE IF NOT EXISTS "saas_template"."ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "project_id" uuid,
  "solution_instance_id" uuid,
  "connection_id" uuid NOT NULL,
  "external_conversation_id" varchar(240) NOT NULL,
  "external_user_id" varchar(240),
  "reply_recipient_id" varchar(240),
  "reply_context_id" varchar(240),
  "status" varchar(24) DEFAULT 'automated' NOT NULL,
  "handoff_reason" text,
  "handoff_at" timestamp with time zone,
  "resumed_at" timestamp with time zone,
  "last_inbound_at" timestamp with time zone,
  "last_outbound_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "ai_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE set null,
  CONSTRAINT "ai_conversations_solution_instance_id_ai_solution_instances_id_fk" FOREIGN KEY ("solution_instance_id") REFERENCES "saas_template"."ai_solution_instances"("id") ON DELETE set null,
  CONSTRAINT "ai_conversations_connection_id_ai_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "saas_template"."ai_provider_connections"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_conversations_connection_external_uidx" ON "saas_template"."ai_conversations" ("connection_id","external_conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_tenant_status_idx" ON "saas_template"."ai_conversations" ("tenant_id","status","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_solution_idx" ON "saas_template"."ai_conversations" ("solution_instance_id","updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "request_id" uuid,
  "direction" varchar(16) NOT NULL,
  "role" varchar(16) NOT NULL,
  "provider_message_id" varchar(240),
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "saas_template"."ai_conversations"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_created_idx" ON "saas_template"."ai_messages" ("conversation_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_messages_tenant_created_idx" ON "saas_template"."ai_messages" ("tenant_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_messages_conversation_provider_uidx" ON "saas_template"."ai_messages" ("conversation_id","provider_message_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."ai_scheduled_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid,
  "solution_instance_id" uuid,
  "connection_id" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "idempotency_key" varchar(180) NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "claim_until" timestamp with time zone,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 12 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_error" text,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_scheduled_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "ai_scheduled_actions_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "saas_template"."ai_conversations"("id") ON DELETE cascade,
  CONSTRAINT "ai_scheduled_actions_solution_instance_id_ai_solution_instances_id_fk" FOREIGN KEY ("solution_instance_id") REFERENCES "saas_template"."ai_solution_instances"("id") ON DELETE set null,
  CONSTRAINT "ai_scheduled_actions_connection_id_ai_provider_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "saas_template"."ai_provider_connections"("id") ON DELETE cascade,
  CONSTRAINT "ai_scheduled_actions_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_scheduled_actions_tenant_idempotency_uidx" ON "saas_template"."ai_scheduled_actions" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scheduled_actions_due_idx" ON "saas_template"."ai_scheduled_actions" ("status","due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_scheduled_actions_conversation_idx" ON "saas_template"."ai_scheduled_actions" ("conversation_id","due_at");
