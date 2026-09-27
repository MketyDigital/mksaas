CREATE TABLE IF NOT EXISTS "saas_template"."mail_workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "plan_key" varchar(64) DEFAULT 'starter' NOT NULL,
  "onboarding_step" varchar(64) DEFAULT 'domain' NOT NULL,
  "default_domain_id" uuid,
  "storage_bytes_used" bigint DEFAULT 0 NOT NULL,
  "monthly_sent" integer DEFAULT 0 NOT NULL,
  "monthly_customer_updates" integer DEFAULT 0 NOT NULL,
  "enabled_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_workspaces_tenant_uidx" ON "saas_template"."mail_workspaces" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_workspaces_status_idx" ON "saas_template"."mail_workspaces" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "saas_template"."mail_workspaces"("id") ON DELETE cascade,
  "domain" varchar(255) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "cloudflare_zone_id" text,
  "sending_enabled" boolean DEFAULT false NOT NULL,
  "routing_enabled" boolean DEFAULT false NOT NULL,
  "spf_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "dkim_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "dmarc_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "mx_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_domains_domain_uidx" ON "saas_template"."mail_domains" ("domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_domains_tenant_idx" ON "saas_template"."mail_domains" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_domains_workspace_idx" ON "saas_template"."mail_domains" ("workspace_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_mailboxes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "saas_template"."mail_workspaces"("id") ON DELETE cascade,
  "domain_id" uuid NOT NULL REFERENCES "saas_template"."mail_domains"("id") ON DELETE cascade,
  "local_part" varchar(128) NOT NULL,
  "display_name" varchar(255),
  "type" varchar(32) DEFAULT 'personal' NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "catch_all" boolean DEFAULT false NOT NULL,
  "forwarding_address" varchar(320),
  "signature_html" text,
  "signature_text" text,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_mailboxes_domain_local_uidx" ON "saas_template"."mail_mailboxes" ("domain_id","local_part");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_mailboxes_tenant_idx" ON "saas_template"."mail_mailboxes" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_mailbox_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "mailbox_id" uuid NOT NULL REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "saas_template"."users"("id") ON DELETE cascade,
  "role" varchar(32) DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_mailbox_members_uidx" ON "saas_template"."mail_mailbox_members" ("mailbox_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_mailbox_members_tenant_idx" ON "saas_template"."mail_mailbox_members" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "mailbox_id" uuid NOT NULL REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade,
  "subject" text,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "priority" varchar(16) DEFAULT 'normal' NOT NULL,
  "assigned_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_threads_tenant_mailbox_idx" ON "saas_template"."mail_threads" ("tenant_id","mailbox_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_threads_last_message_idx" ON "saas_template"."mail_threads" ("last_message_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "mailbox_id" uuid NOT NULL REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade,
  "thread_id" uuid REFERENCES "saas_template"."mail_threads"("id") ON DELETE set null,
  "direction" varchar(16) NOT NULL,
  "provider_message_id" text,
  "internet_message_id" text,
  "from_address" varchar(320) NOT NULL,
  "to_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cc_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "bcc_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subject" text,
  "preview" text,
  "raw_r2_key" text,
  "html_r2_key" text,
  "text_r2_key" text,
  "status" varchar(32) DEFAULT 'queued' NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "is_starred" boolean DEFAULT false NOT NULL,
  "folder" varchar(32) DEFAULT 'inbox' NOT NULL,
  "received_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_messages_tenant_mailbox_idx" ON "saas_template"."mail_messages" ("tenant_id","mailbox_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_messages_thread_idx" ON "saas_template"."mail_messages" ("thread_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_messages_created_idx" ON "saas_template"."mail_messages" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "email" varchar(320) NOT NULL,
  "name" varchar(255),
  "company" varchar(255),
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source" varchar(64) DEFAULT 'manual' NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "last_contacted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_contacts_tenant_email_uidx" ON "saas_template"."mail_contacts" ("tenant_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_contacts_tenant_idx" ON "saas_template"."mail_contacts" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "type" varchar(32) DEFAULT 'transactional' NOT NULL,
  "subject" text,
  "html" text,
  "text" text,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_templates_tenant_idx" ON "saas_template"."mail_templates" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "key_prefix" varchar(32) NOT NULL,
  "key_hash" varchar(128) NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_api_keys_hash_uidx" ON "saas_template"."mail_api_keys" ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_api_keys_tenant_idx" ON "saas_template"."mail_api_keys" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_suppressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "domain_id" uuid REFERENCES "saas_template"."mail_domains"("id") ON DELETE cascade,
  "email" varchar(320) NOT NULL,
  "reason" varchar(64) NOT NULL,
  "source" varchar(64) DEFAULT 'mkety' NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_suppressions_tenant_email_uidx" ON "saas_template"."mail_suppressions" ("tenant_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_suppressions_domain_idx" ON "saas_template"."mail_suppressions" ("domain_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_customer_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "mailbox_id" uuid NOT NULL REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "subject" text NOT NULL,
  "html" text,
  "text" text,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "recipient_count" integer DEFAULT 0 NOT NULL,
  "queued_count" integer DEFAULT 0 NOT NULL,
  "delivered_count" integer DEFAULT 0 NOT NULL,
  "bounced_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "complained_count" integer DEFAULT 0 NOT NULL,
  "scheduled_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_customer_updates_tenant_idx" ON "saas_template"."mail_customer_updates" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_customer_updates_status_idx" ON "saas_template"."mail_customer_updates" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_customer_update_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "update_id" uuid NOT NULL REFERENCES "saas_template"."mail_customer_updates"("id") ON DELETE cascade,
  "contact_id" uuid REFERENCES "saas_template"."mail_contacts"("id") ON DELETE set null,
  "email" varchar(320) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "provider_message_id" text,
  "error_code" varchar(64),
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_update_recipients_update_email_uidx" ON "saas_template"."mail_customer_update_recipients" ("update_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_update_recipients_status_idx" ON "saas_template"."mail_customer_update_recipients" ("update_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_delivery_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "message_id" uuid REFERENCES "saas_template"."mail_messages"("id") ON DELETE set null,
  "update_recipient_id" uuid REFERENCES "saas_template"."mail_customer_update_recipients"("id") ON DELETE set null,
  "provider_event_id" text,
  "event_type" varchar(32) NOT NULL,
  "recipient" varchar(320),
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_delivery_events_tenant_idx" ON "saas_template"."mail_delivery_events" ("tenant_id","occurred_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_delivery_events_message_idx" ON "saas_template"."mail_delivery_events" ("message_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_thread_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "thread_id" uuid NOT NULL REFERENCES "saas_template"."mail_threads"("id") ON DELETE cascade,
  "author_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_thread_notes_thread_idx" ON "saas_template"."mail_thread_notes" ("thread_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_thread_notes_tenant_idx" ON "saas_template"."mail_thread_notes" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_automation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "mailbox_id" uuid REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "trigger_type" varchar(64) NOT NULL,
  "trigger_value" text,
  "action_type" varchar(64) NOT NULL,
  "action_value" text,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_automation_rules_tenant_idx" ON "saas_template"."mail_automation_rules" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_automation_rules_mailbox_idx" ON "saas_template"."mail_automation_rules" ("mailbox_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."mail_app_passwords" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "mailbox_id" uuid NOT NULL REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "saas_template"."users"("id") ON DELETE cascade,
  "name" varchar(128) NOT NULL,
  "password_prefix" varchar(32) NOT NULL,
  "password_hash" varchar(128) NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_app_passwords_hash_uidx" ON "saas_template"."mail_app_passwords" ("password_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_app_passwords_tenant_idx" ON "saas_template"."mail_app_passwords" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mail_app_passwords_mailbox_idx" ON "saas_template"."mail_app_passwords" ("mailbox_id");
