import {Inject, Injectable} from '@nestjs/common'

import {IGetPayableOrder, IMarkOrderPaid} from '@api/order/application'
import {GET_PAYABLE_ORDER, MARK_ORDER_PAID} from '@common/di'
import {IOrderPayments, PayableOrder} from '@api/payment/application'

@Injectable()
export class OrderPayments implements IOrderPayments {
    constructor(
        @Inject(GET_PAYABLE_ORDER) private readonly getPayableOrder: IGetPayableOrder,
        @Inject(MARK_ORDER_PAID) private readonly markOrderPaid: IMarkOrderPaid) {
    }

    async getPayable(orderId: string, userId: string): Promise<PayableOrder> {
        const info = await this.getPayableOrder.execute(orderId, userId)
        return {orderId: info.orderId, orderNumber: info.orderNumber, amount: info.amount, currency: info.currency}
    }

    markPaid(orderId: string): Promise<void> {
        return this.markOrderPaid.execute(orderId)
    }
}
