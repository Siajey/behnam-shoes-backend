import { ConflictError, NotFoundError, ValidationError } from '@common/errors'

export class OrderNotFoundError extends NotFoundError {
  constructor(details?: unknown) {
    super({ message: 'errors.order.notFound', code: 'ORDER_NOT_FOUND', details })
  }
}

export class EmptyOrderError extends ValidationError {
  constructor() {
    super({ message: 'errors.order.empty', code: 'ORDER_EMPTY' })
  }
}

export class InvalidOrderStatusTransitionError extends ConflictError {
  constructor(from: string, to: string) {
    super({
      message: 'errors.order.invalidStatusTransition',
      code: 'ORDER_INVALID_STATUS_TRANSITION',
      details: { from, to },
    })
  }
}

export class OrderVersionConflictError extends ConflictError {
  constructor() {
    super({ message: 'errors.order.versionConflict', code: 'ORDER_VERSION_CONFLICT' })
  }
}

export class OrderPriceChangedError extends ConflictError {
  constructor(expectedTotal: number, actualTotal: number) {
    super({
      message: 'errors.order.priceChanged',
      code: 'ORDER_PRICE_CHANGED',
      details: { expectedTotal, actualTotal },
    })
  }
}

export class OrderCouponInvalidError extends ConflictError {
  constructor(reason: string) {
    super({ message: 'errors.order.couponInvalid', code: 'ORDER_COUPON_INVALID', details: { reason } })
  }
}

export class OrderRecipientIncompleteError extends ValidationError {
  constructor(missing: string[]) {
    super({
      message: 'errors.order.recipientIncomplete',
      code: 'ORDER_RECIPIENT_INCOMPLETE',
      details: { missing },
    })
  }
}

export class OrderNotPayableError extends ConflictError {
  constructor(status: string) {
    super({ message: 'errors.order.notPayable', code: 'ORDER_NOT_PAYABLE', details: { status } })
  }
}
