/** @jest-environment node */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROXY_PATH = path.resolve(process.cwd(), 'src/proxy.ts');

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

  it('keeps app.mkety.com out of generic customer custom-domain resolution', async () => {
    const source = await readFile(PROXY_PATH, 'utf8');
    expect(source).toContain('hostname === appHost ||');
    expect(source).toContain('const isKnownAppHost =');
  });
});
