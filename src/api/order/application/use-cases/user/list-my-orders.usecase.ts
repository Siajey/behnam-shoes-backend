import { IOrderRepository, OrderPage } from '@api/order/domain'
import { ListQuery } from '@common/dto'

import { IListMyOrders } from '../../interfaces'

export default class ListMyOrdersUseCase implements IListMyOrders {
  constructor(private readonly orders: IOrderRepository) {}

  execute(userId: string, query: ListQuery<never>): Promise<OrderPage> {
    return this.orders.listByUser(userId, query)
  }
}
