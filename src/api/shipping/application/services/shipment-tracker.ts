import {
  IShipmentRepository, Shipment, ShipmentVersionConflictError, ShippingCarrierError,
} from '@api/shipping/domain'
import { ConfigProvider } from '@common/configuration'
import { ILogger } from '@common/logger'

import { IShippingCarrierRegistry } from '../ports'

export type RefreshOutcome = 'updated' | 'unchanged' | 'failed' | 'skipped'

export class ShipmentTracker {
  constructor(
    private readonly shipments: IShipmentRepository,
    private readonly registry: IShippingCarrierRegistry,
    private readonly config: ConfigProvider,
    private readonly logger: ILogger,
  ) {}

  intervalMinutes(): number {
    const value = Number(this.config.getOptional('SHIPPING_TRACKING_INTERVAL_MINUTES') ?? 30)
    return Number.isFinite(value) && value >= 1 ? value : 30
  }

  async refresh(shipment: Shipment): Promise<RefreshOutcome> {
    if (shipment.isFinal) return 'skipped'
    const carrier = this.registry.has(shipment.carrier) ? this.registry.get(shipment.carrier) : null
    if (!carrier?.track) return 'skipped'

    const now = new Date()
    const interval = this.intervalMinutes()

    try {
      const tracking = await carrier.track(shipment.trackingCode)
      const changed = shipment.applyTracking(tracking, now, interval)
      await this.shipments.save(shipment)

      if (changed && shipment.status === 'delivered') {
        void this.logger.info('Shipment delivered', {
          module: 'ShipmentTracker',
          operation: 'refresh',
          event: 'shipping.shipment.delivered',
          resourceId: shipment.id,
          data: { orderId: shipment.orderId, carrier: shipment.carrier },
        })
      }
      return changed ? 'updated' : 'unchanged'
    } catch (error) {
      if (error instanceof ShipmentVersionConflictError) return 'skipped'
      if (!(error instanceof ShippingCarrierError)) throw error

      shipment.recordCheckFailure(now, interval)
      try {
        await this.shipments.save(shipment)
      } catch (saveError) {
        if (!(saveError instanceof ShipmentVersionConflictError)) throw saveError
      }
      return 'failed'
    }
  }
}
