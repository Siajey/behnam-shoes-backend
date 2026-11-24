import { AppError, ConflictError, NotFoundError, ValidationError } from '@common/errors'

export class ShippingMethodNotFoundError extends NotFoundError {
  constructor(details?: unknown) {
    super({ message: 'errors.shipping.methodNotFound', code: 'SHIPPING_METHOD_NOT_FOUND', details })
  }
}

export class ShippingMethodCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super({
      message: 'errors.shipping.methodCodeAlreadyExists',
      code: 'SHIPPING_METHOD_CODE_ALREADY_EXISTS',
      details: { code },
    })
  }
}

export class InvalidShippingMethodError extends ValidationError {
  constructor(reason: string) {
    super({
      message: 'errors.shipping.invalidMethod',
      code: 'SHIPPING_INVALID_METHOD',
      details: { reason },
    })
  }
}

export class ShippingQuoteUnavailableError extends ConflictError {
  constructor(methodCode: string) {
    super({
      message: 'errors.shipping.quoteUnavailable',
      code: 'SHIPPING_QUOTE_UNAVAILABLE',
      details: { methodCode },
    })
  }
}

export class InvalidShippingDestinationError extends ValidationError {
  constructor(field: string) {
    super({
      message: 'errors.shipping.invalidDestination',
      code: 'SHIPPING_INVALID_DESTINATION',
      details: { field },
    })
  }
}

export class ShippingCarrierNotSupportedError extends ValidationError {
  constructor(carrier: string) {
    super({
      message: 'errors.shipping.carrierNotSupported',
      code: 'SHIPPING_CARRIER_NOT_SUPPORTED',
      details: { carrier },
    })
  }
}

export class ShippingCarrierError extends AppError {
  constructor(details: { carrier: string; stage: string; code?: string; retryable: boolean }) {
    super({
      message: 'errors.shipping.carrierFailed',
      code: 'SHIPPING_CARRIER_FAILED',
      status: 502,
      details,
    })
  }
}
