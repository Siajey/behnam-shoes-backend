import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common'

import { deserializeCookies } from '@common/util'
import { AUTH_SESSION_VALIDATOR } from '@common/di'
import { SessionValidator } from '@api/session/application'

@Injectable()
export class JwtSessionGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SESSION_VALIDATOR)
    private readonly validateUserSession: SessionValidator,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const rawSetCookie = req.headers['set-cookie']
    const token =
      req.cookies?.['access_token'] ||
      deserializeCookies(rawSetCookie)['access_token']
    req.user = await this.validateUserSession.execute(token)
    return true
  }
}
