-- Route Mkety platform support and account-help links to the first-party Mail mailbox.
UPDATE "saas_template"."platform_site_settings"
SET "contact_email" = 'info@mkety.com', "updated_at" = now()
WHERE "environment" = 'production'
  AND ("contact_email" IS NULL OR lower("contact_email") = 'support@mkety.com');
