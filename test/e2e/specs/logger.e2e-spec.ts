import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe } from '@jest/globals'

import { TestContext, testContextE2e } from './test-context.e2e'
import {
  IUserRepository,
  User,
  UserResponse,
  UserRole,
  UserStatus,
} from '@user/domain'
import * as bcrypt from 'bcryptjs'
import { createUniqueUsername } from '../../util/test.util'
import { deserializeCookies } from '@common/util'

describe('Logger (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let admin: UserResponse
  let userRepository: IUserRepository
  let loggedInAdminCookies: any
  let loggedInAdminCsrf: any

  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    userRepository = ctx.userRepository
    const password = 'Poiuytrewq1'
    const hashedPass = await bcrypt.hash(password, 10)
    admin = await userRepository.save({
      email: 'admin@gmail.com',
      username: createUniqueUsername(),
      passwordHash: hashedPass,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
    } as User)
    const loginResult = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: 'admin@gmail.com',
        password: password,
      },
    })
    loggedInAdminCookies = loginResult.headers['set-cookie']
    loggedInAdminCsrf =
      loginResult.cookies?.['csrf_token'] ||
      deserializeCookies(loggedInAdminCookies)['csrf_token']
  })

  function captureLogs(): { getLogs: () => any[]; restore: () => void } {
    const written: string[] = []
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        written.push(chunk.toString())
        return true
      })

    return {
      getLogs: () =>
        written
          .map((line) => {
            try {
              return JSON.parse(line)
            } catch {
              return null
            }
          })
          .filter(Boolean),
      restore: () => stdoutSpy.mockRestore(),
    }
  }

  it('should log request completion for an unknown route', async () => {
    const { getLogs, restore } = captureLogs()

    await app.inject({ method: 'GET', url: '/auth/login' })

    const requestLog = getLogs().find((log) => log?.res)

    expect(requestLog).toMatchObject({
      level: 'info',
      req: { method: 'GET', url: '/auth/login' },
      res: { statusCode: 404 },
    })

    restore()
  })

  it('should log a session validation failure and request completion', async () => {
    const { getLogs, restore } = captureLogs()

    await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: {
        'set-cookie': loggedInAdminCookies.filter((cookie) =>
          cookie.startsWith('csrf_secret'),
        ),
        'x-csrf-token': loggedInAdminCsrf,
      },
    })

    const logs = getLogs()
    const sessionLog = logs.find((log) => log?.module === 'SessionValidator')
    const requestLog = logs.find((log) => log?.res)

    expect(sessionLog).toMatchObject({
      level: 'warn',
      module: 'SessionValidator',
      event: 'Session.Validate',
      operation: 'session',
      req: { method: 'POST', url: '/auth/change-password' },
      message: 'Session validation failed: access token is missing',
    })

    expect(requestLog).toMatchObject({
      level: 'info',
      req: { method: 'POST', url: '/auth/change-password' },
      res: { statusCode: 401 },
    })

    restore()
  })

  it('should log a csrf activation failure', async () => {
    const { getLogs, restore } = captureLogs()
    await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: {
        'set-cookie': loggedInAdminCookies,
      },
    })
    const csrfLogs = getLogs().find((log) => log?.module === 'CSRFGuard')
    expect(csrfLogs).toMatchObject({
      level: 'warn',
      module: 'CSRFGuard',
      req: { method: 'POST', url: '/auth/change-password' },
      message: 'The csrf token is invalid or missing',
    })
    restore()
  })

  it('should log global rate limit exceeded', async () => {
    const { getLogs, restore } = captureLogs()
    const makeRequest = () =>
      app.inject({
        method: 'GET',
        url: '/health/live',
      })
    const promises: Promise<any>[] = []
    for (let i = 0; i < 101; i++) {
      promises.push(makeRequest())
    }
    await Promise.all(promises)
    const rateLimitLogs = getLogs().find(
      (log) => log.module === 'CustomThrottlerGuard',
    )
    expect(rateLimitLogs).toMatchObject({
      level: 'warn',
      module: 'CustomThrottlerGuard',
      req: { method: 'GET', url: '/health/live' },
      message: 'Rate limit exceeded',
      data: {
        ttl: 60000,
        limit: 100,
        key: expect.any(String),
      },
    })
    restore()
  })
})
