import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { ROLES_KEY } from '@common/constants'
import { ILogger } from '@common/logger'
import { APP_LOGGER_SERVICE } from '@common/di'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const req = context.switchToHttp().getRequest()
    const user = req.user
    if (!user || !requiredRoles.includes(user.role)) {
      this.logger.warn('Authorization failed: insufficient role', {
        module: 'RolesGuard',
        event: 'authorization.activate',
        operation: 'authorization',
        userId: user?.id,
        data: {
          requiredRoles,
          userRole: user?.role ?? null,
        },
      })
      throw new ForbiddenException('errors.auth.accessDenied')
    }

    return true
  }
}
