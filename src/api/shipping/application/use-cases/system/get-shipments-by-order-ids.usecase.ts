import { IShipmentRepository } from '@api/shipping/domain'

import { toShipmentSummary } from '../../helpers'
import { IGetShipmentsByOrderIds, ShipmentSummary } from '../../interfaces'
import { IShippingCarrierRegistry } from '../../ports'

export default class GetShipmentsByOrderIdsUseCase implements IGetShipmentsByOrderIds {
  constructor(
    private readonly shipments: IShipmentRepository,
    private readonly registry: IShippingCarrierRegistry,
  ) {}

  async execute(orderIds: string[]): Promise<ShipmentSummary[]> {
    if (orderIds.length === 0) return []
    const found = await this.shipments.findByOrderIds([...new Set(orderIds)])
    return found.map((s) => toShipmentSummary(s, this.registry))
  }
}
