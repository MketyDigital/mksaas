import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Mail Cloudflare runtime token release contract', () => {
  it('passes only the dedicated Mail token to the authenticated app-host Worker', () => {
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/mkety-mail-production.yml'), 'utf8');

    expect(workflow).toContain('MKETY_MAIL_CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(workflow).toContain(
      'put "$APP_HOST_WORKER_NAME" MKETY_MAIL_CLOUDFLARE_API_TOKEN "$MKETY_MAIL_CLOUDFLARE_API_TOKEN"',
    );
    expect(workflow).toContain("names.has('MKETY_MAIL_CLOUDFLARE_API_TOKEN')");
    expect(workflow).toContain('MKETY_MAIL_CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).not.toContain('put "$APP_HOST_WORKER_NAME" CLOUDFLARE_API_TOKEN');
  });
});
