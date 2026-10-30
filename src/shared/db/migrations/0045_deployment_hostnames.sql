CREATE TABLE "saas_template"."deployment_hostnames" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hostname" varchar(253) NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "saas_template"."projects"("id") ON DELETE CASCADE,
  "application_id" uuid NOT NULL REFERENCES "saas_template"."deploy_applications"("id") ON DELETE CASCADE,
  "environment_id" uuid NOT NULL REFERENCES "saas_template"."deploy_environments"("id") ON DELETE CASCADE,
  "deployment_id" uuid NOT NULL REFERENCES "saas_template"."deployments"("id") ON DELETE CASCADE,
  "kind" varchar(24) NOT NULL,
  "status" varchar(24) DEFAULT 'pending' NOT NULL,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deployment_hostnames_hostname_check" CHECK (
    "hostname" = lower("hostname")
    AND "hostname" !~ '\.$'
    AND "hostname" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.mkety\.app$'
    AND split_part("hostname", '.', 1) NOT IN ('www', 'api', 'app', 'admin', 'ops', 'static', 'assets', 'status', 'support', 'docs')
  ),
  CONSTRAINT "deployment_hostnames_kind_check" CHECK ("kind" IN ('preview', 'production')),
  CONSTRAINT "deployment_hostnames_status_check" CHECK ("status" IN ('pending', 'active', 'suspended', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_hostnames_hostname_uidx" ON "saas_template"."deployment_hostnames" USING btree ("hostname");
--> statement-breakpoint
CREATE UNIQUE INDEX "deployment_hostnames_deployment_kind_uidx" ON "saas_template"."deployment_hostnames" USING btree ("deployment_id", "kind");
--> statement-breakpoint
CREATE INDEX "deployment_hostnames_tenant_idx" ON "saas_template"."deployment_hostnames" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "deployment_hostnames_project_idx" ON "saas_template"."deployment_hostnames" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "deployment_hostnames_status_idx" ON "saas_template"."deployment_hostnames" USING btree ("status");
--> statement-breakpoint
CREATE FUNCTION "saas_template"."verify_deployment_hostname_ownership"() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  deployment_status text;
  deployment_ref text;
BEGIN
  SELECT d.status, d.provider_deployment_ref
    INTO deployment_status, deployment_ref
  FROM "saas_template".deployments d
  JOIN "saas_template".deploy_environments e
    ON e.id = d.environment_id
   AND e.tenant_id = d.tenant_id
   AND e.project_id = d.project_id
   AND e.application_id = d.application_id
  JOIN "saas_template".deploy_applications a
    ON a.id = d.application_id
   AND a.tenant_id = d.tenant_id
   AND a.project_id = d.project_id
  WHERE d.id = NEW.deployment_id
    AND d.tenant_id = NEW.tenant_id
    AND d.project_id = NEW.project_id
    AND d.application_id = NEW.application_id
    AND d.environment_id = NEW.environment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deployment hostname ownership does not match its deployment';
  END IF;
  IF NEW.status = 'active' AND (deployment_status <> 'completed' OR deployment_ref IS NULL OR btrim(deployment_ref) = '') THEN
    RAISE EXCEPTION 'only a completed deployment with a provider reference can be activated';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "deployment_hostnames_verify_ownership"
BEFORE INSERT OR UPDATE OF tenant_id, project_id, application_id, environment_id, deployment_id, status
ON "saas_template"."deployment_hostnames"
FOR EACH ROW EXECUTE FUNCTION "saas_template"."verify_deployment_hostname_ownership"();
