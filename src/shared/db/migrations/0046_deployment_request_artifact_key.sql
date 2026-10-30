ALTER TABLE "saas_template"."deployment_requests"
  ADD COLUMN "artifact_key" text,
  ADD COLUMN "artifact_sha256" varchar(64);
