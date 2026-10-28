import 'module-alias/register'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import * as process from 'node:process'
import { NestFactory } from "@nestjs/core"

import { AppModule } from './app.module'

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      { bufferLogs: true },
    )
    const port = 3000
    const host = '127.0.0.1'
    await app.listen(port, host)
  } catch (error) {
    process.exit(1)
  }
}

bootstrap()
