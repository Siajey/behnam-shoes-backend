import {
    applyDecorators,
    createParamDecorator,
    ExecutionContext,
    SetMetadata,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common'
import {Throttle} from '@nestjs/throttler'

import {deserializeCookies} from '../util'
import {UserRole} from '@api/users/domain'

import {CSRFGuard, JwtSessionGuard, RolesGuard} from "@api/session/presentation";
import {ADMIN_THROTTLE} from "@common/security";

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

export const AdminOnly = () =>
    applyDecorators(
        UseGuards(JwtSessionGuard, RolesGuard),
        Roles(UserRole.ADMIN),
        Throttle(ADMIN_THROTTLE),
    )

export const AdminWriteOnly = () =>
    applyDecorators(
        UseGuards(CSRFGuard, JwtSessionGuard, RolesGuard),
        Roles(UserRole.ADMIN),
        Throttle(ADMIN_THROTTLE),
    )