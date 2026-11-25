import { IShipmentRepository, ShipmentNotFoundError } from '@api/shipping/domain'

import { toShipmentSummary } from '../../helpers'
import { IRefreshShipment } from '../../interfaces'
import { IShippingCarrierRegistry } from '../../ports'
import { ShipmentTracker } from '../../services'

export default class RefreshShipmentUseCase implements IRefreshShipment {
  constructor(
    private readonly shipments: IShipmentRepository,
    private readonly registry: IShippingCarrierRegistry,
    private readonly tracker: ShipmentTracker,
  ) {}

  async execute(orderId: string) {
    const shipment = await this.shipments.findByOrderId(orderId)
    if (!shipment) throw new ShipmentNotFoundError({ orderId })

    const outcome = await this.tracker.refresh(shipment)
    return { summary: toShipmentSummary(shipment, this.registry), outcome }
  }
}
