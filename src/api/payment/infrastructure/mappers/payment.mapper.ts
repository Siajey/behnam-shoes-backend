import {Payment} from '@api/payment/domain'

import {payments} from '../models'

export class PaymentMapper {
    static toDomain(row: typeof payments.$inferSelect): Payment {
        return Payment.restore({
            id: row.id,
            orderId: row.orderId,
            userId: row.userId,
            gateway: row.gateway,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            reference: row.reference,
            trackingCode: row.trackingCode,
            cardMask: row.cardMask,
            failureReason: row.failureReason,
            paidAt: row.paidAt ? new Date(row.paidAt) : null,
            orderConfirmedAt: row.orderConfirmedAt ? new Date(row.orderConfirmedAt) : null,
            version: row.version,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt)
        })
    }

    static toPersistence(p: Payment): typeof payments.$inferInsert {
        return {
            id: p.id,
            orderId: p.orderId,
            userId: p.userId,
            gateway: p.gateway,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            reference: p.reference,
            trackingCode: p.trackingCode,
            cardMask: p.cardMask,
            failureReason: p.failureReason,
            paidAt: p.paidAt ?? null,
            orderConfirmedAt: p.orderConfirmedAt ?? null,
            version: p.version + 1,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt
        }
    }
}
