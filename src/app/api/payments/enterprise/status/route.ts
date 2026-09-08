import { enterpriseOrderRepository } from '@/features/enterprise-checkout/server/repository';

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get('orderId')?.trim();
  if (!orderId || !orderId.startsWith('MKETY-ENT-')) {
    return Response.json({ success: false, message: 'Invalid order.' }, { status: 400 });
  }

  const order = await enterpriseOrderRepository.findById(orderId);
  if (!order) return Response.json({ success: false, message: 'Order not found.' }, { status: 404 });

  return Response.json(
    {
      success: true,
      order: {
        id: order.id,
        provider: order.paymentProvider,
        checkoutStatus: order.checkoutStatus,
        paymentStatus: order.paymentStatus,
        amountMinor: order.amountMinor.toString(),
        currency: order.currency,
        projectName: order.projectName,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        confirmedAt: order.confirmedAt,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
