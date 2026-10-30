import { HttpStatus } from '@nestjs/common'

export class AppError extends Error {
  public readonly code: string
  public readonly status: HttpStatus
  public readonly details?: any
  public readonly args?: any
  public readonly isOperational: boolean

  constructor({
    message,
    code,
    status = HttpStatus.INTERNAL_SERVER_ERROR,
    args,
    details,
    isOperational = true,
  }: {
    message: string
    code: string
    status?: HttpStatus
    args?: any
    details?: any
    isOperational?: boolean
  }) {
    super(message)

    this.name = 'AppError'
    this.code = code
    this.status = status
    this.details = details
    this.isOperational = isOperational
    this.args = args

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      details: this.details,
    }
  }
}

export class NonOperationalError extends AppError {
  constructor({
    details,
    code = 'internalServerError',
    message = 'errors.internalServerError',
  }: {
    details?: any
    code?: string
    message?: string
  }) {
    super({
      message,
      code,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      details,
      isOperational: false,
    })
  }
}

export class ValidationError extends AppError {
  constructor({
    message = 'errors.validation.validationError',
    code,
    details = null,
  }: {
    message?: string
    code?: string
    details?: any
  }) {
    super({
      message,
      code: code ? code : 'VALIDATION_ERROR',
      status: HttpStatus.BAD_REQUEST,
      details,
      isOperational: true,
    })
  }
}

export class NotFoundError extends AppError {
  constructor({
    message = 'errors.NOT_FOUND',
    code,
    details = null,
  }: {
    message?: string
    code?: string
    details?: any
  }) {
    super({
      message,
      code: code ? code : 'NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
      details,
      isOperational: true,
    })
  }
}

export class UnAuthorizedError extends AppError {
  constructor({
    message = 'errors.session.unauthorized',
    code,
    details = null,
  }: {
    message?: string
    code?: string
    details?: any
  }) {
    super({
      message,
      code: code ? code : 'UNAUTHORIZED',
      status: HttpStatus.UNAUTHORIZED,
      details,
      isOperational: true,
    })
  }
}

export class ForbiddenError extends AppError {
  constructor({
    message = 'errors.auth.accessDenied',
    code,
    details = null,
  }: {
    message?: string
    code?: string
    details?: any
  }) {
    super({
      message,
      code: code ? code : 'FORBIDDEN',
      status: HttpStatus.FORBIDDEN,
      details,
      isOperational: true,
    })
  }
}

export class ConflictError extends AppError {
  constructor({
    message = 'errors.conflict',
    code,
    details = null,
  }: {
    message?: string
    code?: string
    details?: any
  }) {
    super({
      message,
      code: code ? code : 'CONFLICT',
      status: HttpStatus.CONFLICT,
      details,
      isOperational: true,
    })
  }
}
