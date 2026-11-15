import { IOrderRepository, Order, OrderNotFoundError } from '@api/order/domain'

import { IGetMyOrder } from '../../interfaces'

export default class GetMyOrderUseCase implements IGetMyOrder {
  constructor(private readonly orders: IOrderRepository) {}

  async execute(orderId: string, userId: string): Promise<Order> {
    const order = await this.orders.findById(orderId)
    if (!order || order.userId !== userId) throw new OrderNotFoundError({ id: orderId })
    return order
  }
}
