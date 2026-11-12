import { applyDecorators, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import { CSRFGuard, JwtSessionGuard } from '@api/session/presentation'

const USER_THROTTLE = {
    default: { ttl: 60_000, limit: process.env.NODE_ENV === 'production' ? 120 : 10_000 },
}

export const UserOnly = () =>
    applyDecorators(UseGuards(CSRFGuard, JwtSessionGuard), Throttle(USER_THROTTLE))