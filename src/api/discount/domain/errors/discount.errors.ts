import { ConflictError, NotFoundError, ValidationError } from '@common/errors'

export class DiscountNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({ message: 'errors.discount.notFound', code: 'DISCOUNT_NOT_FOUND', details })
    }
}
export class InvalidDiscountError extends ValidationError {
    constructor(reason: string) {
        super({ message: 'errors.discount.invalid', code: 'DISCOUNT_INVALID', details: { reason } })
    }
}

export class CouponNotFoundError extends NotFoundError {
    constructor(details?: unknown) {
        super({ message: 'errors.coupon.notFound', code: 'COUPON_NOT_FOUND', details })
    }
}

export class CouponCodeAlreadyExistsError extends ConflictError {
    constructor(code: string) {
        super({ message: 'errors.coupon.codeAlreadyExists', code: 'COUPON_CODE_ALREADY_EXISTS', details: { code } })
    }
}

export class InvalidCouponError extends ValidationError {
    constructor(reason: string) {
        super({ message: 'errors.coupon.invalid', code: 'COUPON_INVALID', details: { reason } })
    }
}

export class CouponHasRedemptionsError extends ConflictError {
    constructor() {
        super({ message: 'errors.coupon.hasRedemptions', code: 'COUPON_HAS_REDEMPTIONS' })
    }
}

export class CouponLimitReachedError extends ConflictError {
    constructor(reason: 'totalLimitReached' | 'userLimitReached') {
        super({ message: 'errors.coupon.limitReached', code: 'COUPON_LIMIT_REACHED', details: { reason } })
    }
}