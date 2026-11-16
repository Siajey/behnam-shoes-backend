import { OrderVersionConflictError } from '@api/order/domain'

export async function withOrderRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof OrderVersionConflictError) return operation()
    throw error
  }
}
