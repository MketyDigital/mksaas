ALTER TABLE "saas_template"."mail_app_passwords"
  ADD COLUMN "protocol_scope" varchar(16) DEFAULT 'all' NOT NULL;
