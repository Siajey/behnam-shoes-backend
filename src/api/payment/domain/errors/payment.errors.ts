import {AppError, ConflictError, NotFoundError, ValidationError} from '@common/errors'

export class PaymentNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({message: 'errors.payment.notFound', code: 'PAYMENT_NOT_FOUND', details})
    }
}

export class InvalidPaymentStatusTransitionError extends ConflictError {
    constructor(from: string, to: string) {
        super({
            message: 'errors.payment.invalidStatusTransition',
            code: 'PAYMENT_INVALID_STATUS_TRANSITION',
            details: {from, to}
        })
    }
}

export class PaymentVersionConflictError extends ConflictError {
    constructor() {
        super({message: 'errors.payment.versionConflict', code: 'PAYMENT_VERSION_CONFLICT'})
    }
}

export class PaymentGatewayError extends AppError {
    constructor(details: { gateway: string; stage: string; code?: string }) {
        super({message: 'errors.payment.gatewayFailed', code: 'PAYMENT_GATEWAY_FAILED', status: 502, details})
    }
}

export class PaymentGatewayNotSupportedError extends ValidationError {
    constructor(what: string) {
        super({message: 'errors.payment.gatewayNotSupported', code: 'PAYMENT_GATEWAY_NOT_SUPPORTED', details: {what}})
    }
}
