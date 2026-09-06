CREATE TABLE IF NOT EXISTS "saas_template"."external_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "saas_template"."users"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "subject" text NOT NULL,
  "email" text,
  "name" text,
  "image" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_identities_provider_subject_idx" ON "saas_template"."external_identities" ("provider", "subject");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_identities_user_idx" ON "saas_template"."external_identities" ("user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."auth_login_transactions" (
  "state" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "verifier" text NOT NULL,
  "nonce" text NOT NULL,
  "return_to" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_login_transactions_expires_idx" ON "saas_template"."auth_login_transactions" ("expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "saas_template"."users"("id") ON DELETE cascade,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_token_hash_idx" ON "saas_template"."auth_sessions" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "saas_template"."auth_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_sessions_expires_idx" ON "saas_template"."auth_sessions" ("expires_at");
