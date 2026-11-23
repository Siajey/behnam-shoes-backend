import {PaymentVersionConflictError} from '@api/payment/domain'

export async function withPaymentRetry<T>(operation: () => Promise<T>, maxRetries = 5): Promise<T> {
    let attempt = 0
    while (true) {
        try {
            return await operation()
        } catch (error) {
            if (!(error instanceof PaymentVersionConflictError) || attempt >= maxRetries) {
                throw error
            }
            attempt++
        }
    }
}