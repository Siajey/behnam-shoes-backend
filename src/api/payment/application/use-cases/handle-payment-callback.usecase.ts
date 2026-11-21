import {IPaymentRepository, PaymentGatewayError, PaymentNotFoundError} from '@api/payment/domain'
import {ILogger} from '@common/logger'
import {IConfirmPayment, IHandlePaymentCallback, PaymentCallbackCommand, PaymentOutcome} from '../interfaces'
import {IPaymentGatewayRegistry} from '../ports'

export default class HandlePaymentCallbackUseCase implements IHandlePaymentCallback {
    constructor(private readonly payments: IPaymentRepository, private readonly gateways: IPaymentGatewayRegistry,
                private readonly confirm: IConfirmPayment, private readonly logger: ILogger) {
    }

    async execute(command: PaymentCallbackCommand): Promise<PaymentOutcome> {
        const gateway = this.gateways.get(command.gateway);
        const callback = gateway.parseCallback(command.params)
        if (!callback) throw new PaymentNotFoundError({gateway: command.gateway})
        const payment = await this.payments.findByGatewayReference(gateway.name, callback.reference)
        if (!payment) throw new PaymentNotFoundError({gateway: command.gateway})
        try {
            return await this.confirm.execute(payment.id)
        } catch (error) {
            if (!(error instanceof PaymentGatewayError)) throw error
            void this.logger.warn('The gateway could not verify the payment yet; the job will retry', {
                module: 'HandlePaymentCallbackUseCase',
                operation: 'execute',
                event: 'payment.callback',
                resourceId: payment.id,
                err: error
            })
            return {paymentId: payment.id, orderId: payment.orderId, status: payment.status}
        }
    }
}
