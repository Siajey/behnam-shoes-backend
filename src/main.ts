import './common/sentry/instrument'

import 'module-alias/register'
import { NestFactory } from '@nestjs/core'
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify'
import * as fastifySecureSession from '@fastify/secure-session'
import multipart from '@fastify/multipart'
import { Logger } from 'nestjs-pino'
import * as process from 'node:process'

import { AppModule } from './app.module'
import { GlobalExceptionFilter } from '@common/errors'
import {
    applyCors,
    applyHelmet,
} from '@common/security'
import { ApiResponseInterceptor } from '@common/api'
import { APP_LOGGER_SERVICE, CONFIG_PROVIDER } from '@common/di'
import { NestConfigProvider } from '@common/configuration'
import { ILogger } from '@common/logger'

async function bootstrap() {
    let logger: ILogger
    try {
        const app = await NestFactory.create<NestFastifyApplication>(
            AppModule,
            new FastifyAdapter(),
            { bufferLogs: true },
        )
        logger = app.get(APP_LOGGER_SERVICE)
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception', {
                module: 'Bootstrap',
                event: 'app.exception',
                operation: 'process',
                err: error,
            })
            process.exit(1)
        })

        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled promise rejection', {
                module: 'Bootstrap',
                event: 'app.exception',
                operation: 'process',
                err: reason,
            })
            process.exit(1)
        })
        const globalExceptionFilter = app.get(GlobalExceptionFilter)
        app.useLogger(app.get(Logger))
        const configService = app.get<NestConfigProvider>(CONFIG_PROVIDER)
        const globalApiResponseInterceptor = app.get(ApiResponseInterceptor)
        const isProd = configService.get('NODE_ENV') === 'production'
        await app.register(fastifySecureSession, {
            secret: configService.get('SESSION_SECRET_CURRENT'),
            salt: configService.get('SESSION_SALT'),
            expiry: 1, // We want to expire this because we have our session implementation
            cookie: {
                path: '/',
                httpOnly: true,
                maxAge: 1000 * 60 * 15,
                secure: isProd,
            },
        })
        await applyHelmet(app, configService.get('NODE_ENV'))
        await applyCors(app, configService)
        await app.register(multipart)
        app.setGlobalPrefix(`/api/${configService.get('API_VERSION')}`)
        app.useGlobalInterceptors(globalApiResponseInterceptor)
        app.useGlobalFilters(globalExceptionFilter)
        const port = configService.get('PORT') || 3000
        const host = isProd ? '0.0.0.0' : '127.0.0.1'
        await app.listen(port, host)
        logger.info('Application started successfully', {
            module: 'Bootstrap',
            event: 'app.start',
            operation: 'start',
            data: { port },
        })
    } catch (error) {
        if (logger) {
            logger.error(
                `Application failed to started${error && error.message ? ' : ' + error.message : ''}`,
                {
                    module: 'Bootstrap',
                    event: 'app.start',
                    operation: 'start',
                    err: error,
                },
            )
        }
        process.exit(1)
    }
}

bootstrap()
