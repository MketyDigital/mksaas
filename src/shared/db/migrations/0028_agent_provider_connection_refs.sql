ALTER TABLE "saas_template"."agents"
  ALTER COLUMN "provider" TYPE varchar(80);
--> statement-breakpoint
ALTER TABLE "saas_template"."agent_versions"
  ALTER COLUMN "provider" TYPE varchar(80);
