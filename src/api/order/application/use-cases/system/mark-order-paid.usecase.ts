import { IOrderRepository, Order, OrderNotFoundError } from '@api/order/domain'
import { ILogger } from '@common/logger'

import { withOrderRetry } from '../../helpers'
import { IMarkOrderPaid } from '../../interfaces'
import { ICartGateway, IOrderPromotions } from '../../ports'

export default class MarkOrderPaidUseCase implements IMarkOrderPaid {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly promotions: IOrderPromotions,
    private readonly cart: ICartGateway,
    private readonly logger: ILogger,
  ) {}

  async execute(orderId: string): Promise<void> {
    const paid = await withOrderRetry(async (): Promise<Order | null> => {
      const order = await this.orders.findById(orderId)
      if (!order) throw new OrderNotFoundError({ id: orderId })
      if (order.hasBeenPaid) return null

      order.markPaid()
      await this.orders.save(order)
      return order
    })
    if (!paid) return

    void this.logger.info('Order paid', {
      module: 'MarkOrderPaidUseCase',
      operation: 'execute',
      event: 'order.pay',
      resourceId: paid.id,
      data: { orderNumber: paid.orderNumber, total: paid.total, currency: paid.currency },
    })

    await this.bestEffort(paid.id, 'order.coupon.commit', () => this.promotions.commitCoupon(paid.id))
    await this.bestEffort(paid.id, 'order.cart.clear', () => this.cart.clear(paid.userId))
  }

  private async bestEffort(orderId: string, event: string, action: () => Promise<void>): Promise<void> {
    try {
      await action()
    } catch (error) {
      void this.logger.error('A step after payment failed and needs follow-up', {
        module: 'MarkOrderPaidUseCase',
        operation: 'execute',
        event,
        resourceId: orderId,
        err: error,
      })
    }
  }
}
