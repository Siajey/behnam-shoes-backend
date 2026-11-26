import { IShipmentRepository } from '@api/shipping/domain'
import { ConfigProvider } from '@common/configuration'
import { ILogger } from '@common/logger'

import { IPollShipments, PollShipmentsResult } from '../../interfaces'
import { IShippingCarrierRegistry } from '../../ports'
import { ShipmentTracker } from '../../services'

const BATCH_SIZE = 50
const DAY_MS = 24 * 60 * 60 * 1000

export default class PollShipmentsUseCase implements IPollShipments {
  private running = false

  constructor(
    private readonly shipments: IShipmentRepository,
    private readonly registry: IShippingCarrierRegistry,
    private readonly tracker: ShipmentTracker,
    private readonly config: ConfigProvider,
    private readonly logger: ILogger,
  ) {}

  async execute(): Promise<PollShipmentsResult> {
    const result: PollShipmentsResult = { checked: 0, updated: 0, failed: 0 }
    if (this.running) return result
    this.running = true

    try {
      const carriers = this.registry.names().filter((name) => !!this.registry.get(name).track)
      if (carriers.length === 0) return result

      const maxAgeDays = Number(this.config.getOptional('SHIPPING_TRACKING_MAX_AGE_DAYS') ?? 30)
      const due = await this.shipments.findDueForPolling({
        now: new Date(),
        limit: BATCH_SIZE,
        carriers,
        createdAfter: new Date(Date.now() - maxAgeDays * DAY_MS),
      })

      for (const shipment of due) {
        const outcome = await this.tracker.refresh(shipment)
        if (outcome === 'skipped') continue
        result.checked += 1
        if (outcome === 'updated') result.updated += 1
        if (outcome === 'failed') result.failed += 1
      }

      if (result.failed > 0) {
        void this.logger.warn('Some shipments could not be checked, they will be retried later', {
          module: 'PollShipmentsUseCase',
          operation: 'execute',
          event: 'shipping.tracking.poll',
          data: { ...result },
        })
      }
      return result
    } finally {
      this.running = false
    }
  }
}
