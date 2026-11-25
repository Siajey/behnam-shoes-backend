import { ShipmentVersionConflictError } from '@api/shipping/domain'

export async function withShipmentRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!(error instanceof ShipmentVersionConflictError) || attempt >= attempts) throw error
    }
  }
}
