import {
  InvalidOrderStatusTransitionError, IOrderRepository, OrderVersionConflictError,
} from '@api/order/domain'
import { ILogger } from '@common/logger'

import { ISyncShipmentStatuses } from '../../interfaces'
import { IOrderShipments } from '../../ports'

const LOOKBACK_DAYS = 14
const LIMIT = 500

export default class SyncShipmentStatusesUseCase implements ISyncShipmentStatuses {
  constructor(
    private readonly orders: IOrderRepository,
    private readonly shipments: IOrderShipments,
    private readonly logger: ILogger,
  ) {}

  async execute(): Promise<{ delivered: number }> {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const orderIds = await this.shipments.listDeliveredOrderIds(since, LIMIT)
    if (orderIds.length === 0) return { delivered: 0 }

    const orders = await this.orders.findShippedByIds(orderIds)
    let delivered = 0

    for (const order of orders) {
      try {
        order.deliver(null)
        await this.orders.save(order)
        delivered += 1
      } catch (error) {
        if (
          error instanceof InvalidOrderStatusTransitionError ||
          error instanceof OrderVersionConflictError
        ) {
          continue
        }
        throw error
      }
    }

    if (delivered > 0) {
      void this.logger.info('Orders marked delivered from tracking', {
        module: 'SyncShipmentStatusesUseCase',
        operation: 'execute',
        event: 'order.sync.delivered',
        data: { delivered },
      })
    }
    return { delivered }
  }
}
