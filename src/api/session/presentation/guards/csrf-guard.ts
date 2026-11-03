import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { FastifyRequest } from 'fastify'

import { deserializeCookies } from '@common/util'
import { APP_LOGGER_SERVICE, CONFIG_PROVIDER, HASH_GENERATOR } from '@common/di'
import { ConfigProvider } from '@common/configuration'
import { IHashGenerator } from '@common/security'
import { ILogger } from '@common/logger'

@Injectable()
export class CSRFGuard implements CanActivate {
  constructor(
    @Inject(CONFIG_PROVIDER)
    private readonly configService: ConfigProvider,
    @Inject(HASH_GENERATOR)
    private readonly hashGenerator: IHashGenerator,
    @Inject(APP_LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const rawSetCookie = request.headers['set-cookie']
    const csrfSecret =
      request.cookies?.['csrf_secret'] ||
      deserializeCookies(rawSetCookie)['csrf_secret']
    if (!csrfSecret) {
      this.logger.warn('The csrf secret is invalid or missing', {
        module: 'CSRFGuard',
        event: 'csrf.activate',
        operation: 'csrf',
      })
      throw new ForbiddenException({
        code: 'Invalid_CSRF_Secret',
        message: 'errors.sessions.invalidCsrfSecret',
      })
    }

    const expectedToken = this.hashGenerator.hashMac(
      csrfSecret,
      this.configService.get('CSRF_TOKEN_SECRET') || 'csrf',
    )
    const receivedToken = request.headers['x-csrf-token']

    if (expectedToken !== receivedToken) {
      this.logger.warn('The csrf token is invalid or missing', {
        module: 'CSRFGuard',
        event: 'csrf.activate',
        operation: 'csrf',
      })
      throw new ForbiddenException({
        code: 'UNAUTHORIZED',
        message: 'errors.sessions.invalidCsrfToken',
      })
    }
    return true
  }
}
