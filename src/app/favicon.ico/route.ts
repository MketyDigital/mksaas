export function GET(request: Request) {
  const target = new URL('/mkety-logo.png', request.url);

  return new Response(null, {
    status: 307,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'public, max-age=300',
    },
  });
}
