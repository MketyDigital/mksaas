function safeJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST() {
  return safeJson(
    {
      success: false,
      message: 'Enterprise payment links are issued by Mkety after the project scope and payment amount are agreed.',
    },
    403,
  );
}
