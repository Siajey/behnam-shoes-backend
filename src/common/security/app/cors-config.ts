import {CorsOptions} from '@nestjs/common/interfaces/external/cors-options.interface'
import {ForbiddenException} from '@nestjs/common'
import {NestFastifyApplication} from '@nestjs/platform-fastify'
import fastifyCors from '@fastify/cors'

import {ConfigProvider} from '@common/configuration'

export const applyCors = async (app: NestFastifyApplication, configService: ConfigProvider) => {
    const isDev = configService.get('NODE_ENV') !== 'production'
    const allowedOrigins = isDev
        ? [configService.get('FRONTEND_URL_DEV'), configService.get('FRONTEND_URL')]
        : [configService.get('FRONTEND_URL')]

    const CORSConfigs: CorsOptions = {
        origin: (origin, cb) => {
            if (!origin) return cb(null, true)
            if (origin && allowedOrigins.includes(origin)) {
                cb(null, true)
            } else {
                cb(new ForbiddenException('Your are not allowed to access this resource.'), false)
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type',
            'Authorization',
            'x-csrf-token',
            'x-lang',
            'x-custom-lang'],
    }

    await app.register(fastifyCors, CORSConfigs)
}
