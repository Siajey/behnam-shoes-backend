import { IOrderRepository, Order, OrderNotFoundError } from '@api/order/domain'
import { ILogger } from '@common/logger'

import { withOrderRetry } from '../../helpers'
import { IUpdateOrderStatus, UpdateOrderStatusCommand } from '../../interfaces'
import { IOrderPromotions } from '../../ports'

export default class UpdateOrderStatusUseCase implements IUpdateOrderStatus {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly promotions: IOrderPromotions,
    private readonly logger: ILogger,
  ) {}

  execute(command: UpdateOrderStatusCommand, actorId: string): Promise<Order> {
    return withOrderRetry(async () => {
      const order = await this.orders.findById(command.orderId)
      if (!order) throw new OrderNotFoundError({ id: command.orderId })

      const note = command.note ?? null
      switch (command.action) {
        case 'startProcessing':
          order.startProcessing(actorId, note)
          break
        case 'ship':
          order.ship(actorId, { carrier: command.carrier, trackingCode: command.trackingCode }, note)
          break
        case 'deliver':
          order.deliver(actorId, note)
          break
        case 'cancel':
          order.cancel(actorId, note)
          break
      }

      await this.orders.save(order)
      if (command.action === 'cancel') await this.promotions.releaseCoupon(order.id)

      void this.logger.info('Order status updated', {
        module: 'UpdateOrderStatusUseCase',
        operation: 'execute',
        event: 'order.status.update',
        userId: actorId,
        resourceId: order.id,
        data: { action: command.action, status: order.status },
      })
      return order
    })
  }
}
