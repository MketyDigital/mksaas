/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROXY_PATH = path.resolve(process.cwd(), 'src/proxy.ts');
const REPAIR_WORKFLOW_PATH = path.resolve(
  process.cwd(),
  '.github/workflows/mkety-app-host-production-repair.yml',
);

describe('app.mkety.com platform host contract', () => {
  it('routes the canonical app host root into the authenticated /app entry before generic public routing', async () => {
    const source = await readFile(PROXY_PATH, 'utf8');

    expect(source).toContain("process.env.NEXT_PUBLIC_APP_URL || 'https://app.mkety.com'");
    expect(source).toContain("hostname.toLowerCase()===appHost && pathname==='/'");
    expect(source).toContain("url.pathname='/app'");

    const appRedirect = source.indexOf("hostname.toLowerCase()===appHost && pathname==='/'");
    const genericPublic = source.indexOf('if (isPublicPath(effectivePathname))');

    expect(appRedirect).toBeGreaterThan(-1);
    expect(genericPublic).toBeGreaterThan(-1);
    expect(appRedirect).toBeLessThan(genericPublic);
  });

  it('keeps authenticated application routes off the public mkety.com host', async () => {
    const source = await readFile(PROXY_PATH, 'utf8');

    expect(source).toContain("pathname === '/app'");
    expect(source).toContain("pathname === '/select-tenant'");
    expect(source).toContain("pathname === '/create-workspace'");
    expect(source).toContain("pathname.startsWith('/t/')");
    expect(source).toContain("'https://mail.mkety.com'");
    expect(source).toContain("'https://ai.mkety.com'");

    const publicHostRedirect = source.indexOf('getPublicHostProductRedirect(requestUrl)');
    const authRead = source.indexOf('const session = await auth(request)');
    expect(publicHostRedirect).toBeGreaterThan(-1);
    expect(authRead).toBeGreaterThan(-1);
    expect(publicHostRedirect).toBeLessThan(authRead);
  });

  it('keeps app.mkety.com out of generic customer custom-domain resolution', async () => {
    const source = await readFile(PROXY_PATH, 'utf8');
    expect(source).toContain('hostname === appHost ||');
    expect(source).toContain('const isKnownAppHost =');
  });

  it('keeps the production repair isolated to app.mkety.com with explicit rollback and exact-SHA authorization', async () => {
    const workflow = await readFile(REPAIR_WORKFLOW_PATH, 'utf8');

    expect(workflow).toContain('APP_WORKER_NAME: mkety-app-host');
    expect(workflow).toContain('REPAIR APP.MKETY.COM');
    expect(workflow).toContain('verified_sha');
    expect(workflow).toContain('RELEASE_BRANCH: main');
    expect(workflow).toContain('Verify SHA matches current main');
    expect(workflow).toContain('mkety-production-db-v2');
    expect(workflow).toContain('app.mkety.com');
    expect(workflow).toContain('workers/domains');
    expect(workflow).toContain('restore');
    expect(workflow).not.toContain('for host in mkety.com www.mkety.com');
    expect(workflow).not.toContain('PRODUCTION_WORKER_NAME: mkety-platform');
  });
});
