import { Shipment } from '@api/shipping/domain'

import { shipmentEvents, shipments } from '../models'

type ShipmentRow = typeof shipments.$inferSelect
type EventRow = typeof shipmentEvents.$inferSelect

export class ShipmentMapper {
  static toDomain(row: ShipmentRow, eventRows: EventRow[]): Shipment {
    return Shipment.restore({
      id: row.id,
      orderId: row.orderId,
      methodCode: row.methodCode,
      carrier: row.carrier,
      trackingCode: row.trackingCode,
      status: row.status,
      events: eventRows
        .map((e) => ({
          key: e.eventKey,
          status: e.status,
          description: e.description,
          location: e.location,
          occurredAt: e.occurredAt,
        }))
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()),
      deliveredAt: row.deliveredAt,
      lastCheckedAt: row.lastCheckedAt,
      nextCheckAt: row.nextCheckAt,
      failureCount: row.failureCount,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  static toPersistence(s: Shipment) {
    const shipment: typeof shipments.$inferInsert = {
      id: s.id,
      orderId: s.orderId,
      methodCode: s.methodCode,
      carrier: s.carrier,
      trackingCode: s.trackingCode,
      status: s.status,
      deliveredAt: s.deliveredAt ?? null,
      lastCheckedAt: s.lastCheckedAt ?? null,
      nextCheckAt: s.nextCheckAt,
      failureCount: s.failureCount,
      version: s.version,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }
    const events: (typeof shipmentEvents.$inferInsert)[] = s.events.map((e) => ({
      shipmentId: s.id,
      eventKey: e.key.slice(0, 200),
      status: e.status,
      description: e.description.slice(0, 500),
      location: e.location?.slice(0, 200) ?? null,
      occurredAt: e.occurredAt,
    }))
    return { shipment, events }
  }
}
