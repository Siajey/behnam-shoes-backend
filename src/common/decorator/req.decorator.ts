import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'

import { deserializeCookies } from '../util'
import { UserRole } from '@user/domain'

export const ReqUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)

export const RefreshToken = createParamDecorator<string>(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    const refreshToken =
      request.cookies?.['refresh_token'] ||
      deserializeCookies(request.headers['set-cookie'])['refresh_token']
    if (!refreshToken) {
      throw new UnauthorizedException('errors.sessions.missingRefreshToken')
    }
    return refreshToken.toString()
  },
)

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles)

export const Files = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): null | Record<string, FileStorage.MultipartFile[]> => {
    const req = ctx.switchToHttp().getRequest()
    return req.storedFiles
  },
)
