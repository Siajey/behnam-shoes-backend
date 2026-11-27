import { AppError, ConflictError, NotFoundError, ValidationError } from '@common/errors'

export class ReviewNotFoundError extends NotFoundError {
  constructor(details?: unknown) {
    super({ message: 'errors.review.notFound', code: 'REVIEW_NOT_FOUND', details })
  }
}

export class ReviewAlreadyExistsError extends ConflictError {
  constructor() {
    super({ message: 'errors.review.alreadyExists', code: 'REVIEW_ALREADY_EXISTS' })
  }
}

export class ReviewPurchaseRequiredError extends AppError {
  constructor() {
    super({ message: 'errors.review.purchaseRequired', code: 'REVIEW_PURCHASE_REQUIRED', status: 403 })
  }
}

export class ReviewProductNotFoundError extends NotFoundError {
  constructor(productId: string) {
    super({ message: 'errors.review.productNotFound', code: 'REVIEW_PRODUCT_NOT_FOUND', details: { productId } })
  }
}

export class InvalidReviewError extends ValidationError {
  constructor(reason: string) {
    super({ message: 'errors.review.invalid', code: 'REVIEW_INVALID', details: { reason } })
  }
}

export class ReviewReplyNotFoundError extends NotFoundError {
  constructor() {
    super({ message: 'errors.review.replyNotFound', code: 'REVIEW_REPLY_NOT_FOUND' })
  }
}

export class ReviewVersionConflictError extends ConflictError {
  constructor() {
    super({ message: 'errors.review.versionConflict', code: 'REVIEW_VERSION_CONFLICT' })
  }
}
