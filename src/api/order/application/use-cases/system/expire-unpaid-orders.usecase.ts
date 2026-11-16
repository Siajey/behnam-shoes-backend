import {
  InvalidOrderStatusTransitionError, IOrderRepository, OrderVersionConflictError,
} from '@api/order/domain'
import { ILogger } from '@common/logger'

import { IExpireUnpaidOrders } from '../../interfaces'
import { IOrderPromotions } from '../../ports'

const BATCH_SIZE = 100

export default class ExpireUnpaidOrdersUseCase implements IExpireUnpaidOrders {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly promotions: IOrderPromotions,
    private readonly logger: ILogger,
  ) {}

  async execute(): Promise<{ expired: number }> {
    const batch = await this.orders.findExpirable(new Date(), BATCH_SIZE)
    let expired = 0

    for (const order of batch) {
      try {
        order.expire()
        await this.orders.save(order)
        await this.promotions.releaseCoupon(order.id)
        expired++
      } catch (error) {
        if (
          error instanceof OrderVersionConflictError ||
          error instanceof InvalidOrderStatusTransitionError
        ) {
          continue
        }
        throw error
      }
    }

    if (expired > 0) {
      void this.logger.info('Unpaid orders expired', {
        module: 'ExpireUnpaidOrdersUseCase',
        operation: 'execute',
        event: 'order.expire',
        data: { count: expired },
      })
    }
    return { expired }
  }
}
