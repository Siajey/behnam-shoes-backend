import { ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler'

import { TooManyRequestsException } from '@common/errors'
import { APP_LOGGER_SERVICE } from '@common/di'
import { ILogger } from '@common/logger'

@Injectable()
export default class CustomThrottlerGuard extends ThrottlerGuard {
  @Inject(APP_LOGGER_SERVICE)
  private readonly logger: ILogger

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest()
    this.logger.warn('Rate limit exceeded', {
      module: 'CustomThrottlerGuard',
      event: 'throttle.exceeded',
      operation: 'throttle',
      userId: req.user?.id,
      data: {
        ttl: detail.ttl,
        limit: detail.limit,
        key: detail.key,
      },
    })
    throw new TooManyRequestsException('errors.validation.tooManyRequests')
  }
}
