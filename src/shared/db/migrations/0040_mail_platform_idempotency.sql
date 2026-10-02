ALTER TABLE "saas_template"."mail_messages"
  ADD COLUMN "platform_idempotency_key" varchar(255);

CREATE UNIQUE INDEX "mail_messages_tenant_platform_idempotency_uidx"
  ON "saas_template"."mail_messages" USING btree ("tenant_id", "platform_idempotency_key");
