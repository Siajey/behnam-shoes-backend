import {IPaymentRepository, PaymentNotFoundError} from '@api/payment/domain'
import {ILogger} from '@common/logger'
import {withPaymentRetry} from '../helpers'
import {IConfirmPayment, PaymentOutcome} from '../interfaces'
import {IOrderPayments, IPaymentGatewayRegistry} from '../ports'

export default class ConfirmPaymentUseCase implements IConfirmPayment {
    constructor(private readonly payments: IPaymentRepository, private readonly orders: IOrderPayments,
                private readonly gateways: IPaymentGatewayRegistry, private readonly logger: ILogger) {
    }

    execute(paymentId: string): Promise<PaymentOutcome> {
        return withPaymentRetry(async () => {
            const payment = await this.payments.findById(paymentId)
            if (!payment) throw new PaymentNotFoundError({id: paymentId})
            if (payment.status === 'paid') {
                if (payment.needsOrderConfirmation) await this.confirmOrder(payment, true)
                return this.outcome(payment)
            }
            if (payment.status !== 'redirected' || !payment.reference) return this.outcome(payment)
            const verification = await this.gateways.get(payment.gateway).verify(payment.reference)
            if (verification.status === 'pending') return this.outcome(payment)
            if (verification.status === 'failed') {
                payment.markFailed(verification.failureCode ?? 'declined');
                await this.payments.save(payment);
                return this.outcome(payment)
            }
            if (verification.amount !== null && verification.amount !== payment.amount) {
                payment.markFailed('amount_mismatch');
                await this.payments.save(payment)
                void this.logger.error('Verified amount differs from the payment amount', {
                    module: 'ConfirmPaymentUseCase',
                    operation: 'execute',
                    event: 'payment.amount-mismatch',
                    resourceId: payment.id,
                    data: {orderId: payment.orderId, expected: payment.amount, verified: verification.amount}
                })
                return this.outcome(payment)
            }
            await this.warnIfOrderAlreadyPaid(payment)
            payment.markPaid({
                trackingCode: verification.trackingCode,
                cardMask: verification.cardMask,
                paidAt: verification.paidAt
            })
            await this.confirmOrder(payment, false)
            await this.payments.save(payment)
            void this.logger.info('Payment confirmed', {
                module: 'ConfirmPaymentUseCase', operation: 'execute', event: 'payment.confirm',
                resourceId: payment.id, data: {orderId: payment.orderId, amount: payment.amount}
            })
            return this.outcome(payment)
        })
    }

    private async confirmOrder(payment: import('@api/payment/domain').Payment, saveAfter: boolean): Promise<void> {
        try {
            await this.orders.markPaid(payment.orderId);
            payment.markOrderConfirmed();
            if (saveAfter) await this.payments.save(payment)
        } catch (error) {
            void this.logger.error('The order could not be marked paid after a verified payment', {
                module: 'ConfirmPaymentUseCase',
                operation: 'confirmOrder',
                event: 'payment.order-confirm',
                resourceId: payment.id,
                data: {orderId: payment.orderId},
                err: error
            })
        }
    }

    private async warnIfOrderAlreadyPaid(payment: import('@api/payment/domain').Payment): Promise<void> {
        const others = await this.payments.findByOrderId(payment.orderId)
        if (others.some(p => p.id !== payment.id && p.status === 'paid')) void this.logger.error('A second payment succeeded for an order that is already paid', {
            module: 'ConfirmPaymentUseCase',
            operation: 'warnIfOrderAlreadyPaid',
            event: 'payment.duplicate',
            resourceId: payment.id,
            data: {orderId: payment.orderId, amount: payment.amount}
        })
    }

    private outcome(payment: import('@api/payment/domain').Payment): PaymentOutcome {
        return {paymentId: payment.id, orderId: payment.orderId, status: payment.status}
    }
}
