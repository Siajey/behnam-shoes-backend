import {IPaymentRepository, Payment, PaymentNotFoundError} from '@api/payment/domain'
import {IGetPaymentStatus} from '../interfaces'

export default class GetPaymentStatusUseCase implements IGetPaymentStatus {
    constructor(private readonly payments: IPaymentRepository) {
    }

    async execute(paymentId: string, userId: string): Promise<Payment> {
        const payment = await this.payments.findById(paymentId)
        if (!payment || payment.userId !== userId) throw new PaymentNotFoundError({id: paymentId})
        return payment
    }
}
