import { IOrderRepository, OrderNotFoundError } from '@api/order/domain'

import { toPaymentInfo } from '../../helpers'
import { IGetOrderPaymentInfo, OrderPaymentInfo } from '@api/order/application'

export default class GetOrderPaymentInfoUseCase implements IGetOrderPaymentInfo {
  constructor(private readonly orders: IOrderRepository) {}

  async execute(orderId: string): Promise<OrderPaymentInfo> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new OrderNotFoundError({ id: orderId })
    return toPaymentInfo(order, new Date())
  }
}
