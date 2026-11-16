import { IOrderRepository, Order, OrderNotFoundError } from '@api/order/domain'

import { IAdminGetOrder } from '../../interfaces'

export default class AdminGetOrderUseCase implements IAdminGetOrder {
  constructor(private readonly orders: IOrderRepository) {}

  async execute(orderId: string): Promise<Order> {
    const order = await this.orders.findById(orderId)
    if (!order) throw new OrderNotFoundError({ id: orderId })
    return order
  }
}
