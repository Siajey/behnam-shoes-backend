import { Order, orderLineTotal, OrderLine } from '@api/order/domain'

export class OrderPresenter {
  static summary(order: Order) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      itemCount: order.itemCount,
      total: order.total,
      currency: order.currency,
      previewImageKey: order.lines[0]?.imageKey ?? null,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
    }
  }

  static detail(order: Order, now: Date = new Date()) {
    return {
      ...OrderPresenter.summary(order),
      totals: OrderPresenter.totals(order),
      coupon: order.coupon ? { code: order.coupon.code } : null,
      lines: order.lines.map(OrderPresenter.line),
      shippingAddress: order.shippingAddress,
      recipient: order.recipient,
      shipment: order.shipment,
      canPay: order.canPay(now),
      expiresAt: order.expiresAt.toISOString(),
      timeline: order.events.map((e) => ({
        status: e.status,
        note: e.note,
        at: e.createdAt.toISOString(),
      })),
    }
  }

  static adminSummary(order: Order) {
    return {
      ...OrderPresenter.summary(order),
      userId: order.userId,
      recipient: `${order.recipient.firstName} ${order.recipient.lastName}`,
    }
  }

  static adminDetail(order: Order, now: Date = new Date()) {
    return {
      ...OrderPresenter.detail(order, now),
      userId: order.userId,
      lines: order.lines.map((l) => ({
        ...OrderPresenter.line(l),
        sku: l.sku,
        externalSource: l.externalSource,
        externalId: l.externalId,
      })),
      timeline: order.events.map((e) => ({
        status: e.status,
        note: e.note,
        actorId: e.actorId,
        at: e.createdAt.toISOString(),
      })),
    }
  }

  private static totals(order: Order) {
    return {
      subtotal: order.subtotal,
      productDiscountTotal: order.productDiscountTotal,
      couponDiscount: order.couponDiscount,
      shippingFee: order.shippingFee,
      total: order.total,
    }
  }

  private static line(l: OrderLine) {
    return {
      variantId: l.variantId,
      productId: l.productId,
      productName: l.productName,
      productSlug: l.productSlug,
      imageKey: l.imageKey,
      attributes: l.attributes,
      quantity: l.quantity,
      originalUnitPrice: l.originalUnitPrice,
      unitPrice: l.unitPrice,
      couponAllocation: l.couponAllocation,
      lineTotal: orderLineTotal(l),
    }
  }
}
