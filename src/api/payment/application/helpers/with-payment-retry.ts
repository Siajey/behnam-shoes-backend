import {PaymentVersionConflictError} from '@api/payment/domain'

export async function withPaymentRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation()
    } catch (error) {
        if (error instanceof PaymentVersionConflictError) return operation()
        throw error
    }
}
