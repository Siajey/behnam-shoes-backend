import { ConflictError, NotFoundError, ValidationError } from '@common/errors'

export class CartItemNotFoundError extends NotFoundError {
    constructor(variantId: string) {
        super({ message: 'errors.cart.itemNotFound', code: 'CART_ITEM_NOT_FOUND', details: { variantId } })
    }
}

export class CartLineLimitReachedError extends ValidationError {
    constructor(max: number) {
        super({ message: 'errors.cart.itemLimitReached', code: 'CART_LINE_LIMIT_REACHED', details: { max } })
    }
}

export class CartQuantityLimitExceededError extends ValidationError {
    constructor(max: number) {
        super({
            message: 'errors.cart.quantityLimitExceeded',
            code: 'CART_QUANTITY_LIMIT_EXCEEDED',
            details: { max },
        })
    }
}

export class InvalidCartQuantityError extends ValidationError {
    constructor() {
        super({ message: 'errors.cart.invalidQuantity', code: 'CART_INVALID_QUANTITY' })
    }
}

export class CartVariantUnavailableError extends ConflictError {
    constructor(variantId: string, reason: string) {
        super({
            message: 'errors.cart.variantUnavailable',
            code: 'CART_VARIANT_UNAVAILABLE',
            details: { variantId, reason },
        })
    }
}

export class CartInsufficientStockError extends ConflictError {
    constructor(variantId: string, available: number) {
        super({
            message: 'errors.cart.insufficientStock',
            code: 'CART_INSUFFICIENT_STOCK',
            details: { variantId, available },
        })
    }
}

export class CartCheckoutBlockedError extends ConflictError {
    constructor(problems: { variantId: string | null; reason: string }[]) {
        super({
            message: 'errors.cart.checkoutBlocked',
            code: 'CART_CHECKOUT_BLOCKED',
            details: { problems },
        })
    }
}

export class CartVersionConflictError extends ConflictError {
    constructor() {
        super({ message: 'errors.cart.versionConflict', code: 'CART_VERSION_CONFLICT' })
    }
}