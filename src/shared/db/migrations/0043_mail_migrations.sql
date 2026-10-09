CREATE TABLE "saas_template"."mail_domain_cutover_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cutover_id" uuid NOT NULL,
	"check_name" varchar(64) NOT NULL,
	"passed" boolean NOT NULL,
	"evidence_ref" text,
	"safe_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checked_by_user_id" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);;
--> statement-breakpoint
CREATE TABLE "saas_template"."mail_domain_cutovers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"state" varchar(32) DEFAULT 'inventory' NOT NULL,
	"previous_dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"authorized_by_user_id" text,
	"authorized_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);;
--> statement-breakpoint
CREATE TABLE "saas_template"."mail_migration_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"migration_run_id" uuid NOT NULL,
	"source_key" varchar(512) NOT NULL,
	"folder_path" text NOT NULL,
	"source_uid_validity" varchar(128),
	"source_uid" varchar(128),
	"internet_message_id" text,
	"content_fingerprint" varchar(128) NOT NULL,
	"target_message_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);;
--> statement-breakpoint
CREATE TABLE "saas_template"."mail_migration_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_mailbox_address" varchar(320) NOT NULL,
	"destination_mailbox_id" uuid NOT NULL,
	"source_type" varchar(32) NOT NULL,
	"source_host" varchar(253),
	"source_port" integer,
	"encrypted_credential" text,
	"mode" varchar(16) DEFAULT 'initial' NOT NULL,
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"source_cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"imported_messages" integer DEFAULT 0 NOT NULL,
	"skipped_messages" integer DEFAULT 0 NOT NULL,
	"failed_messages" integer DEFAULT 0 NOT NULL,
	"safe_error_code" varchar(64),
	"actor_user_id" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_domain_cutover_checks" ADD CONSTRAINT "mail_domain_cutover_checks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_domain_cutover_checks" ADD CONSTRAINT "mail_domain_cutover_checks_cutover_id_mail_domain_cutovers_id_fk" FOREIGN KEY ("cutover_id") REFERENCES "saas_template"."mail_domain_cutovers"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_domain_cutover_checks" ADD CONSTRAINT "mail_domain_cutover_checks_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_domain_cutovers" ADD CONSTRAINT "mail_domain_cutovers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_domain_cutovers" ADD CONSTRAINT "mail_domain_cutovers_domain_id_mail_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "saas_template"."mail_domains"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_domain_cutovers" ADD CONSTRAINT "mail_domain_cutovers_authorized_by_user_id_users_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_messages" ADD CONSTRAINT "mail_migration_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_messages" ADD CONSTRAINT "mail_migration_messages_migration_run_id_mail_migration_runs_id_fk" FOREIGN KEY ("migration_run_id") REFERENCES "saas_template"."mail_migration_runs"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_messages" ADD CONSTRAINT "mail_migration_messages_target_message_id_mail_messages_id_fk" FOREIGN KEY ("target_message_id") REFERENCES "saas_template"."mail_messages"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_runs" ADD CONSTRAINT "mail_migration_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_runs" ADD CONSTRAINT "mail_migration_runs_workspace_id_mail_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "saas_template"."mail_workspaces"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_runs" ADD CONSTRAINT "mail_migration_runs_destination_mailbox_id_mail_mailboxes_id_fk" FOREIGN KEY ("destination_mailbox_id") REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE cascade ON UPDATE no action;;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_migration_runs" ADD CONSTRAINT "mail_migration_runs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;;
--> statement-breakpoint
CREATE UNIQUE INDEX "mail_domain_cutover_checks_name_uidx" ON "saas_template"."mail_domain_cutover_checks" USING btree ("cutover_id","check_name");;
--> statement-breakpoint
CREATE INDEX "mail_domain_cutover_checks_tenant_idx" ON "saas_template"."mail_domain_cutover_checks" USING btree ("tenant_id","checked_at");;
--> statement-breakpoint
CREATE UNIQUE INDEX "mail_domain_cutovers_tenant_domain_uidx" ON "saas_template"."mail_domain_cutovers" USING btree ("tenant_id","domain_id");;
--> statement-breakpoint
CREATE UNIQUE INDEX "mail_migration_messages_source_uid_uidx" ON "saas_template"."mail_migration_messages" USING btree ("tenant_id","source_key","folder_path","source_uid_validity","source_uid");;
--> statement-breakpoint
CREATE UNIQUE INDEX "mail_migration_messages_source_fingerprint_uidx" ON "saas_template"."mail_migration_messages" USING btree ("tenant_id","source_key","folder_path","content_fingerprint");;
--> statement-breakpoint
CREATE INDEX "mail_migration_messages_tenant_idx" ON "saas_template"."mail_migration_messages" USING btree ("tenant_id","created_at");;
--> statement-breakpoint
CREATE INDEX "mail_migration_runs_tenant_created_idx" ON "saas_template"."mail_migration_runs" USING btree ("tenant_id","created_at");;
--> statement-breakpoint
CREATE INDEX "mail_migration_runs_status_idx" ON "saas_template"."mail_migration_runs" USING btree ("status","updated_at");;
