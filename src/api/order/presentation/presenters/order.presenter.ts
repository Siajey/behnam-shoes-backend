import { Order, OrderLine, orderLineTotal } from '@api/order/domain'

export type UrlOf = (fileKey: string) => string

const imageUrl = (key: string | null, urlOf: UrlOf): string | null => (key ? urlOf(key) : null)

export class OrderPresenter {
    static summary(order: Order, urlOf: UrlOf) {
        const previewKey = order.lines[0]?.imageKey ?? null
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            itemCount: order.itemCount,
            total: order.total,
            currency: order.currency,
            previewImageKey: previewKey,
            previewImageUrl: imageUrl(previewKey, urlOf),
            createdAt: order.createdAt.toISOString(),
            paidAt: order.paidAt?.toISOString() ?? null,
        }
    }

    static detail(order: Order, urlOf: UrlOf, now: Date = new Date()) {
        return {
            ...OrderPresenter.summary(order, urlOf),
            totals: OrderPresenter.totals(order),
            coupon: order.coupon ? { code: order.coupon.code } : null,
            lines: order.lines.map((l) => OrderPresenter.line(l, urlOf)),
            shippingAddress: order.shippingAddress,
            shippingMethod: order.shippingMethod,
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

    static adminSummary(order: Order, urlOf: UrlOf) {
        return {
            ...OrderPresenter.summary(order, urlOf),
            userId: order.userId,
            recipient: `${order.recipient.firstName} ${order.recipient.lastName}`,
        }
    }

    static adminDetail(order: Order, urlOf: UrlOf, now: Date = new Date()) {
        return {
            ...OrderPresenter.detail(order, urlOf, now),
            userId: order.userId,
            lines: order.lines.map((l) => ({
                ...OrderPresenter.line(l, urlOf),
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

    private static line(l: OrderLine, urlOf: UrlOf) {
        return {
            variantId: l.variantId,
            productId: l.productId,
            productName: l.productName,
            productSlug: l.productSlug,
            imageKey: l.imageKey,
            imageUrl: imageUrl(l.imageKey, urlOf),
            attributes: l.attributes,
            quantity: l.quantity,
            originalUnitPrice: l.originalUnitPrice,
            unitPrice: l.unitPrice,
            couponAllocation: l.couponAllocation,
            lineTotal: orderLineTotal(l),
        }
    }
}