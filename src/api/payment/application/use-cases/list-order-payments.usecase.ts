import {IPaymentRepository, Payment} from '@api/payment/domain'
import {IListOrderPayments} from '../interfaces'

export default class ListOrderPaymentsUseCase implements IListOrderPayments {
    constructor(private readonly payments: IPaymentRepository) {
    }

    execute(orderId: string): Promise<Payment[]> {
        return this.payments.findByOrderId(orderId)
    }
}
