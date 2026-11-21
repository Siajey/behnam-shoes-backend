import {Payment} from '@api/payment/domain'

export class PaymentPresenter {
    static status(p: Payment) {
        return {
            paymentId: p.id,
            orderId: p.orderId,
            status: p.status,
            amount: p.amount,
            currency: p.currency,
            paidAt: p.paidAt?.toISOString() ?? null
        }
    }

    static admin(p: Payment) {
        return {
            ...PaymentPresenter.status(p),
            gateway: p.gateway,
            reference: p.reference,
            trackingCode: p.trackingCode,
            cardMask: p.cardMask,
            failureReason: p.failureReason,
            orderConfirmedAt: p.orderConfirmedAt?.toISOString() ?? null,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        }
    }
}
