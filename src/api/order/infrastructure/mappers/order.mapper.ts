import {Order} from '@api/order/domain'

import {orderLines, orders, orderStatusEvents} from '../models'

export class OrderMapper {
    static toDomain(
        row: typeof orders.$inferSelect,
        lines: (typeof orderLines.$inferSelect)[],
        events: (typeof orderStatusEvents.$inferSelect)[],
    ): Order {
        return Order.restore({
            id: row.id,
            orderNumber: row.orderNumber,
            userId: row.userId,
            status: row.status,
            lines: [...lines]
                .sort((a, b) => a.position - b.position)
                .map((l) => ({
                    variantId: l.variantId,
                    productId: l.productId,
                    productName: l.productName,
                    productSlug: l.productSlug,
                    imageKey: l.imageKey,
                    sku: l.sku,
                    externalSource: l.externalSource,
                    externalId: l.externalId,
                    attributes: l.attributes,
                    quantity: l.quantity,
                    originalUnitPrice: l.originalUnitPrice,
                    unitPrice: l.unitPrice,
                    couponAllocation: l.couponAllocation,
                })),
            coupon: row.couponId && row.couponCode ? {couponId: row.couponId, code: row.couponCode} : null,
            shippingFee: row.shippingFee,
            shippingMethod: {
                name: row.shippingMethodName,
                code: row.shippingMethodCode,
            },
            currency: row.currency,
            shippingAddress: {
                province: row.shipProvince,
                city: row.shipCity,
                street: row.shipStreet,
                postalCode: row.shipPostalCode,
            },
            recipient: {
                firstName: row.recipientFirstName,
                lastName: row.recipientLastName,
                phoneNumber: row.recipientPhone,
            },
            shipment: {carrier: row.carrier, trackingCode: row.trackingCode},
            idempotencyKey: row.idempotencyKey,
            expiresAt: row.expiresAt,
            paidAt: row.paidAt,
            events: [...events]
                .map((e) => ({
                    id: e.id,
                    status: e.status,
                    note: e.note,
                    actorId: e.actorId,
                    createdAt: e.createdAt,
                }))
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
            version: row.version,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })
    }

    static toPersistence(order: Order): {
        order: Omit<typeof orders.$inferInsert, 'orderNumber'>
        lines: (typeof orderLines.$inferInsert)[]
        events: (typeof orderStatusEvents.$inferInsert)[]
    } {
        return {
            order: {
                id: order.id,
                userId: order.userId,
                status: order.status,
                currency: order.currency,
                shippingFee: order.shippingFee,
                couponId: order.coupon?.couponId ?? null,
                couponCode: order.coupon?.code ?? null,
                shipProvince: order.shippingAddress.province,
                shipCity: order.shippingAddress.city,
                shipStreet: order.shippingAddress.street,
                shipPostalCode: order.shippingAddress.postalCode,
                recipientFirstName: order.recipient.firstName,
                recipientLastName: order.recipient.lastName,
                recipientPhone: order.recipient.phoneNumber,
                shippingMethodCode: order.shippingMethod.code,
                shippingMethodName: order.shippingMethod.name,
                carrier: order.shipment.carrier,
                trackingCode: order.shipment.trackingCode,
                idempotencyKey: order.idempotencyKey,
                expiresAt: order.expiresAt,
                paidAt: order.paidAt ?? null,
                version: order.version + 1,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            },
            lines: order.lines.map((l, position) => ({
                orderId: order.id,
                position,
                variantId: l.variantId,
                productId: l.productId,
                productName: l.productName,
                productSlug: l.productSlug,
                imageKey: l.imageKey,
                sku: l.sku,
                externalSource: l.externalSource,
                externalId: l.externalId,
                attributes: l.attributes,
                quantity: l.quantity,
                originalUnitPrice: l.originalUnitPrice,
                unitPrice: l.unitPrice,
                couponAllocation: l.couponAllocation,
            })),
            events: order.events.map((e) => ({
                id: e.id,
                orderId: order.id,
                status: e.status,
                note: e.note,
                actorId: e.actorId,
                createdAt: e.createdAt,
            })),
        }
    }
}
