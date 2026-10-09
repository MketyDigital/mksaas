CREATE TABLE "saas_template"."mail_mailbox_ingress_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE CASCADE,
  "mailbox_id" uuid NOT NULL REFERENCES "saas_template"."mail_mailboxes"("id") ON DELETE CASCADE,
  "domain_id" uuid NOT NULL REFERENCES "saas_template"."mail_domains"("id") ON DELETE CASCADE,
  "local_part" varchar(128) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "mail_mailbox_ingress_aliases_domain_local_uidx" ON "saas_template"."mail_mailbox_ingress_aliases" USING btree ("domain_id", "local_part");
CREATE INDEX "mail_mailbox_ingress_aliases_tenant_mailbox_idx" ON "saas_template"."mail_mailbox_ingress_aliases" USING btree ("tenant_id", "mailbox_id");
