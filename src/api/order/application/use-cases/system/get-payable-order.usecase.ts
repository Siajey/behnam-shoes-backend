import { IOrderRepository, OrderNotFoundError, OrderNotPayableError } from '@api/order/domain'

import { toPaymentInfo } from '../../helpers'
import { IGetPayableOrder, OrderPaymentInfo } from '../../interfaces'

export default class GetPayableOrderUseCase implements IGetPayableOrder {
  constructor(private readonly orders: IOrderRepository) {}

  async execute(orderId: string, userId: string): Promise<OrderPaymentInfo> {
    const order = await this.orders.findById(orderId)
    if (!order || order.userId !== userId) throw new OrderNotFoundError({ id: orderId })

    const info = toPaymentInfo(order, new Date())
    if (!info.canPay) throw new OrderNotPayableError(order.status)
    return info
  }
}
