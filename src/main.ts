import 'module-alias/register'

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import * as process from 'node:process'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { ILogger } from '@common/logger'
import { APP_LOGGER_SERVICE } from '@common/di'

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
    const port = 3000
    const host = '127.0.0.1'
    await app.listen(port, host)
  } catch (error) {
    process.exit(1)
  }
}

bootstrap()
