import { ShippingMethod } from '@api/shipping/domain'

import { shippingMethods } from '../models'

export class ShippingMethodMapper {
  static toDomain(row: typeof shippingMethods.$inferSelect): ShippingMethod {
    return ShippingMethod.restore({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      carrier: row.carrier,
      service: row.service,
      isActive: row.isActive,
      position: row.position,
      fallbackFee: row.fallbackFee,
      freeThreshold: row.freeThreshold,
      handlingFee: row.handlingFee,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    })
  }

  static toPersistence(m: ShippingMethod): typeof shippingMethods.$inferInsert {
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      description: m.description,
      carrier: m.carrier,
      service: m.service,
      isActive: m.isActive,
      position: m.position,
      fallbackFee: m.fallbackFee,
      freeThreshold: m.freeThreshold,
      handlingFee: m.handlingFee,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }
  }
}
