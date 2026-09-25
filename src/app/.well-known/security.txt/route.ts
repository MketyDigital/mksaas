export const dynamic = 'force-dynamic';

export function GET() {
  const expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    'Contact: mailto:support@mkety.com',
    'Canonical: https://mkety.com/.well-known/security.txt',
    'Policy: https://mkety.com/docs/trust/security-and-reliability',
    'Preferred-Languages: en',
    `Expires: ${expires}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
