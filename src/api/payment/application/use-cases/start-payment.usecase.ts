import {IPaymentRepository, Payment, PaymentGatewayNotSupportedError} from '@api/payment/domain'
import {ConfigProvider} from '@common/configuration'
import {ILogger} from '@common/logger'
import {createPaymentDescription, withPaymentRetry} from '../helpers'
import {IStartPayment, StartPaymentCommand, StartPaymentResult} from '../interfaces'
import {IOrderPayments, IPaymentGatewayRegistry} from '../ports'

export default class StartPaymentUseCase implements IStartPayment {
    constructor(
        private readonly payments: IPaymentRepository,
        private readonly orders: IOrderPayments,
        private readonly gateways: IPaymentGatewayRegistry,
        private readonly config: ConfigProvider,
        private readonly logger: ILogger,
    ) {
    }

    async execute(command: StartPaymentCommand, userId: string): Promise<StartPaymentResult> {
        const order = await this.orders.getPayable(command.orderId, userId)
        const gateway = this.gateways.get(command.gateway ?? this.gateways.defaultName())
        if (!gateway.currencies.includes(order.currency)) {
            throw new PaymentGatewayNotSupportedError(order.currency)
        }

        const payment = Payment.start({
            orderId: order.orderId,
            userId,
            gateway: gateway.name,
            amount: order.amount,
            currency: order.currency,
        })
        await this.payments.create(payment)

        try {
            const base = this.config.get('PAYMENT_CALLBACK_BASE_URL').replace(/\/+$/, '')
            const target = await gateway.requestPayment({
                paymentId: payment.id,
                amount: payment.amount,
                callbackUrl: `${base}/api/${this.config.get('API_VERSION')}/payments/callback/${gateway.name}`,
                description: createPaymentDescription(order.orderNumber),
            })

            await withPaymentRetry(async () => {
                const current = (await this.payments.findById(payment.id)) ?? payment
                current.markRedirected(target.reference)
                await this.payments.save(current)
            })

            void this.logger.info('Payment started', {
                module: 'StartPaymentUseCase',
                operation: 'execute',
                event: 'payment.start',
                userId,
                resourceId: payment.id,
                data: {orderId: order.orderId, gateway: gateway.name, amount: payment.amount},
            })

            return {paymentId: payment.id, redirectUrl: target.redirectUrl}
        } catch (error) {
            if (payment.status === 'initiated') {
                await withPaymentRetry(async () => {
                    const current = (await this.payments.findById(payment.id)) ?? payment
                    if (current.status === 'initiated') {
                        current.markFailed('gateway_request_failed')
                        await this.payments.save(current)
                    }
                })
            }

            void this.logger.error('The gateway did not create the payment', {
                module: 'StartPaymentUseCase',
                operation: 'execute',
                event: 'payment.start',
                userId,
                resourceId: payment.id,
                err: error,
            })
            throw error
        }
    }
}