import { CartVersionConflictError } from '@api/cart/domain'

export async function withCartRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        if (error instanceof CartVersionConflictError) return operation()
        throw error
    }
}