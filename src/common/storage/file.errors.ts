import { NotFoundError, ValidationError } from '@common/errors'

export class FileTypeNotAllowedError extends ValidationError {
  constructor(contentType: string, allowed: readonly string[]) {
    super({
      message: 'errors.file.fileTypeNotAllowed',
      code: 'FILE_TYPE_NOT_ALLOWED',
      details: { contentType, allowed },
    })
  }
}

export class FileTooLargeError extends ValidationError {
  constructor(maxSizeBytes: number) {
    super({
      message: 'errors.file.fileTooLarge',
      code: 'FILE_TOO_LARGE',
      details: { maxSizeBytes },
    })
  }
}

export class FileNotFoundError extends NotFoundError {
  constructor(key: string) {
    super({
      message: 'errors.file.fileNotFound',
      code: 'FILE_NOT_FOUND',
      details: { key },
    })
  }
}
