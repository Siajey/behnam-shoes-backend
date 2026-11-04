import { Test, TestingModule } from '@nestjs/testing'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import fastifySecureSession from '@fastify/secure-session'
import multipart from '@fastify/multipart'

import { ApiResponseInterceptor } from '@common/api'
import { GlobalExceptionFilter } from '@common/errors'
import {
  applyCors,
  applyHelmet,
} from '@common/security'
import { IUserRepository } from '@api/users/domain'
import { UserRepository } from '@api/users/infrastructure'
import { CONFIG_PROVIDER, USER_REPOSITORY } from '@common/di'
import { NestConfigProvider } from '@common/configuration'
import {AppModule} from "../../../src/app.module";

export type TestContext = {
  app: NestFastifyApplication
  userRepository: IUserRepository
}

let instance: TestContext | null = null

export const testContextE2e = async (): Promise<TestContext> => {
  if (instance) return instance

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  )
  const configService = app.get<NestConfigProvider>(CONFIG_PROVIDER)
  await app.register(fastifySecureSession, {
    secret: configService.get('SESSION_SECRET_CURRENT'),
    salt: configService.get('SESSION_SALT'),
    expiry: 1, // We want to expire this because we have our session implementation
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 1000 * 60 * 15,
      secure: configService.get('NODE_ENV') === 'production',
    },
  })
  await applyHelmet(app, configService.get('NODE_ENV'))
  await applyCors(app, configService)
  await app.register(multipart)
  app.useGlobalFilters(app.get(GlobalExceptionFilter))
  app.useGlobalInterceptors(app.get(ApiResponseInterceptor))

  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  instance = { app, userRepository: app.get<UserRepository>(USER_REPOSITORY) }
  return instance
}
export const destroyTestContext = async () => {
  await instance?.app.close()
  instance = null
}
