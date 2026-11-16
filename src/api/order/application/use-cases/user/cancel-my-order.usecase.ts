import {
  InvalidOrderStatusTransitionError, IOrderRepository, Order, OrderNotFoundError,
} from '@api/order/domain'
import { ILogger } from '@common/logger'

import { withOrderRetry } from '../../helpers'
import { ICancelMyOrder } from '../../interfaces'
import { IOrderPromotions } from '../../ports'

export default class CancelMyOrderUseCase implements ICancelMyOrder {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly promotions: IOrderPromotions,
    private readonly logger: ILogger,
  ) {}

  execute(orderId: string, userId: string): Promise<Order> {
    return withOrderRetry(async () => {
      const order = await this.orders.findById(orderId)
      if (!order || order.userId !== userId) throw new OrderNotFoundError({ id: orderId })

      if (order.status !== 'pending_payment') {
        throw new InvalidOrderStatusTransitionError(order.status, 'cancelled')
      }

      order.cancel(userId)
      await this.orders.save(order)
      await this.promotions.releaseCoupon(order.id)

      void this.logger.info('Order cancelled by the customer', {
        module: 'CancelMyOrderUseCase',
        operation: 'execute',
        event: 'order.cancel',
        userId,
        resourceId: order.id,
      })
      return order
    })
  }
}
