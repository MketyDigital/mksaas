import fs from 'node:fs';
import path from 'node:path';

describe('ZITADEL first-party Mail rollout workflow', () => {
  const workflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/mkety-zitadel-email-reconcile.yml'), 'utf8');

  it('requires an explicit manual provider test and activation choice', () => {
    expect(workflow).toContain('email_provider:');
    expect(workflow).toContain('test_provider:');
    expect(workflow).toContain('activate_provider:');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain("inputs.test_provider == true");
    expect(workflow).toContain("inputs.activate_provider == true");
  });

  it('supports Mkety SMTP while preserving a tested Brevo rollback path', () => {
    expect(workflow).toContain('MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD');
    expect(workflow).toContain('smtp.mkety.com:465');
    expect(workflow).toContain('info@mkety.com');
    expect(workflow).toContain('Mkety First-Party Mail SMTP');
    expect(workflow).toContain('Mkety Brevo SMTP');
    expect(workflow).toContain('Legacy ZITADEL SMTP supports one provider; refusing to overwrite the active provider');
    expect(workflow).toContain('steps.smtp_test.outcome == \'success\'');
  });

  it('does not use Brevo SMTP credentials or reply-to when Mkety SMTP is selected', () => {
    expect(workflow).toContain('MKETY_SMTP_PASSWORD: ${{ secrets.MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD }}');
    expect(workflow).toContain('BREVO_SMTP_PASSWORD: ${{ secrets.BREVO_SMTP_KEY || secrets.BREVO_SMTP_PASSWORD || secrets.SMTP_PASSWORD || secrets.SMTP_KEY }}');
    expect(workflow).toContain('SMTP_REPLY_TO: ${{ inputs.email_provider == \'mkety\' && \'info@mkety.com\' || secrets.BREVO_REPLY_TO_EMAIL || secrets.SMTP_REPLY_TO || secrets.SUPPORT_EMAIL }}');
    expect(workflow).toContain('if [ "$EMAIL_PROVIDER" = "mkety" ]; then');
    expect(workflow).toContain('SMTP_PASSWORD="$MKETY_SMTP_PASSWORD"');
    expect(workflow).not.toContain("inputs.email_provider == 'mkety' && secrets.MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD || secrets.BREVO_SMTP_KEY");
  });

  it('masks credentials and logs provider metadata without secret values', () => {
    expect(workflow).toContain('echo "::add-mask::${!n}"');
    expect(workflow).toContain('process.env.PASSWORD');
    expect(workflow).toContain('ZITADEL_ACTIVE_EMAIL_PROVIDER_SAFE');
  });

  it('resolves the reserved tenant from the masked Platform Control slug without printing the slug', () => {
    const mailWorkflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/mkety-mail-production.yml'), 'utf8');
    const dbWorkflow = fs.readFileSync(path.join(process.cwd(), '.github/workflows/mkety-coolify-production-db-executor.yml'), 'utf8');
    const migrationRunner = fs.readFileSync(path.join(process.cwd(), 'ops/coolify-migration/run.sh'), 'utf8');
    expect(mailWorkflow).toContain('secrets.MKETY_PLATFORM_CONTROL_TENANT_SLUG');
    expect(mailWorkflow).toContain('Validate required Platform Control tenant slug');
    expect(mailWorkflow).toContain('::add-mask::$MKETY_PLATFORM_CONTROL_TENANT_SLUG');
    expect(mailWorkflow).toContain('needs.production-db.outputs.first_party_mail_tenant_id');
    expect(mailWorkflow).not.toContain('secrets.MKETY_FIRST_PARTY_MAIL_TENANT_ID');
    expect(migrationRunner).toContain('scripts/report-first-party-mail-readiness.ts');
    expect(dbWorkflow).toContain('MKETY_FIRST_PARTY_MAIL_TENANT_ID=');
    expect(dbWorkflow).toContain('::add-mask::$CONTROL_TENANT_SLUG');
    expect(mailWorkflow).toContain('put "$PRODUCTION_WORKER_NAME" MKETY_FIRST_PARTY_MAIL_TENANT_ID "$MKETY_FIRST_PARTY_MAIL_TENANT_ID"');
  });
});
