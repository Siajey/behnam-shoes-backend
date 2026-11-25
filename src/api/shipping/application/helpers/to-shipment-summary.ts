import { Shipment } from '@api/shipping/domain'

import { ShipmentSummary } from '../interfaces'
import { IShippingCarrierRegistry } from '../ports'

export function toShipmentSummary(shipment: Shipment, registry: IShippingCarrierRegistry): ShipmentSummary {
  const carrier = registry.has(shipment.carrier) ? registry.get(shipment.carrier) : null
  return {
    orderId: shipment.orderId,
    methodCode: shipment.methodCode,
    carrier: shipment.carrier,
    trackingCode: shipment.trackingCode,
    trackingUrl: carrier?.trackingUrl?.(shipment.trackingCode) ?? null,
    autoTracked: !!carrier?.track,
    status: shipment.status,
    deliveredAt: shipment.deliveredAt,
    lastCheckedAt: shipment.lastCheckedAt,
    events: shipment.events.map((e) => ({
      status: e.status,
      description: e.description,
      location: e.location,
      occurredAt: e.occurredAt,
    })),
  }
}
