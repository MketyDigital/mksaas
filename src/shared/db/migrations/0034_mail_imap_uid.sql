CREATE SEQUENCE IF NOT EXISTS "saas_template"."mail_message_imap_uid_seq"
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 100;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_messages"
  ADD COLUMN IF NOT EXISTS "imap_uid" bigint;
--> statement-breakpoint
UPDATE "saas_template"."mail_messages"
SET "imap_uid" = nextval('saas_template.mail_message_imap_uid_seq')
WHERE "imap_uid" IS NULL;
--> statement-breakpoint
ALTER TABLE "saas_template"."mail_messages"
  ALTER COLUMN "imap_uid" SET DEFAULT nextval('saas_template.mail_message_imap_uid_seq'),
  ALTER COLUMN "imap_uid" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mail_messages_mailbox_imap_uid_uidx"
  ON "saas_template"."mail_messages" ("mailbox_id","imap_uid");
