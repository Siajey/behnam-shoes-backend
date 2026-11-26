import { ShipmentSummary } from '@api/shipping/application'

export class ShipmentPresenter {
  static summary(s: ShipmentSummary) {
    return {
      orderId: s.orderId,
      methodCode: s.methodCode,
      carrier: s.carrier,
      trackingCode: s.trackingCode,
      trackingUrl: s.trackingUrl,
      autoTracked: s.autoTracked,
      status: s.status,
      deliveredAt: s.deliveredAt?.toISOString() ?? null,
      lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
      events: s.events.map((e) => ({
        status: e.status,
        description: e.description,
        location: e.location,
        at: e.occurredAt.toISOString(),
      })),
    }
  }
}
