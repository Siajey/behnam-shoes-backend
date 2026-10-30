import { HttpException, HttpStatus } from '@nestjs/common'

export class TooManyRequestsException extends HttpException {
  constructor(message: string = 'tooManyRequests') {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        error: 'TOO_MANY_REQUESTS',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }
}
