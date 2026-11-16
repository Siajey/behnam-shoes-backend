import { AdminOrderListCriteria, IOrderRepository, OrderPage } from '@api/order/domain'

import { IAdminListOrders } from '../../interfaces'

export default class AdminListOrdersUseCase implements IAdminListOrders {
  constructor(private readonly orders: IOrderRepository) {}

  execute(criteria: AdminOrderListCriteria): Promise<OrderPage> {
    return this.orders.listAll(criteria)
  }
}
