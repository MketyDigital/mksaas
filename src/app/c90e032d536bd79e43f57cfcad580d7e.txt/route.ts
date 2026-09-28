export const dynamic = 'force-static';

export function GET() {
  return new Response('c90e032d536bd79e43f57cfcad580d7e\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
