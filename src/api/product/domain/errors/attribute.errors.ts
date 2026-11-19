import {ConflictError, NotFoundError, ValidationError} from "@common/errors";

export class AttributeDefinitionNotFoundError extends NotFoundError {
  constructor(details?: unknown) {
    super({ message: 'errors.attribute.notFound', code: 'ATTRIBUTE_NOT_FOUND', details })
  }
}

export class AttributeKeyAlreadyExistsError extends ConflictError {
  constructor(key: string) {
    super({
      message: 'errors.attribute.keyAlreadyExists',
      code: 'ATTRIBUTE_KEY_ALREADY_EXISTS',
      details: { key },
    })
  }
}

export class InvalidAttributeDefinitionError extends ValidationError {
  constructor(reason: string) {
    super({
      message: 'errors.attribute.invalidDefinition',
      code: 'ATTRIBUTE_INVALID_DEFINITION',
      details: { reason },
    })
  }
}

export class InvalidAttributeValueError extends ValidationError {
  constructor(key: string, reason: string) {
    super({
      message: 'errors.attribute.invalidValue',
      code: 'ATTRIBUTE_INVALID_VALUE',
      details: { key, reason },
    })
  }
}

export class AttributeInUseError extends ConflictError {
  constructor() {
    super({ message: 'errors.attribute.inUse', code: 'ATTRIBUTE_IN_USE' })
  }
}

export class AttributeOptionInUseError extends ConflictError {
  constructor(optionIds: string[]) {
    super({
      message: 'errors.attribute.optionInUse',
      code: 'ATTRIBUTE_OPTION_IN_USE',
      details: { optionIds },
    })
  }
}
