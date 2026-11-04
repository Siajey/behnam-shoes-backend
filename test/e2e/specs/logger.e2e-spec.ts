import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it, jest } from '@jest/globals'
import { HttpStatus } from '@nestjs/common'

import { TestContext, testContextE2e } from './test-context.e2e'
import { IUserRepository, User, UserRole, UserStatus } from '@api/users/domain'
import { LogMeta } from '@common/logger'
import { createUser, loginWithOtp } from '../../util/test.util'

interface CapturedLog extends LogMeta {
  level: 'info' | 'warn' | 'error' | 'debug' | 'verbose'
  message?: string
  req?: {
    method: string
    url: string
  }
  res?: {
    statusCode: number
  }
}

interface CapturedLogs {
  getLogs: () => CapturedLog[]
  restore: () => void
}

describe('Logger (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let userRepository: IUserRepository

  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    userRepository = ctx.userRepository
  })

  function captureLogs(): CapturedLogs {
    const written: string[] = []

    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk) => {
        written.push(
          typeof chunk === 'string'
            ? chunk
            : Buffer.isBuffer(chunk)
              ? chunk.toString()
              : Buffer.from(chunk).toString(),
        )

        return true
      })

    return {
      getLogs: () =>
        written
          .flatMap((line) =>
            line
              .split('\n')
              .filter(Boolean)
              .map((entry) => {
                try {
                  return JSON.parse(entry) as CapturedLog
                } catch {
                  return null
                }
              }),
          )
          .filter((log): log is CapturedLog => log !== null),

      restore: () => stdoutSpy.mockRestore(),
    }
  }

  async function withCapturedLogs(
    callback: (getLogs: CapturedLogs['getLogs']) => Promise<void>,
  ): Promise<void> {
    const { getLogs, restore } = captureLogs()

    try {
      await callback(getLogs)
    } finally {
      restore()
    }
  }

  describe('request completion', () => {
    it('logs request completion for an unknown route', async () => {
      await withCapturedLogs(async (getLogs) => {
        const res = await app.inject({
          method: 'GET',
          url: '/auth/login',
        })

        expect(res.statusCode).toBe(HttpStatus.NOT_FOUND)

        const requestLog = getLogs().find((log) => log.res)

        expect(requestLog).toMatchObject({
          level: 'info',
          req: {
            method: 'GET',
            url: '/auth/login',
          },
          res: {
            statusCode: HttpStatus.NOT_FOUND,
          },
        })
      })
    })
  })

  describe('session validation', () => {
    it('logs a session validation failure and request completion', async () => {
      await withCapturedLogs(async (getLogs) => {
        const res = await app.inject({
          method: 'GET',
          url: '/users/me',
        })
        expect(res.statusCode).toBe(HttpStatus.UNAUTHORIZED)

        const logs = getLogs()

        const sessionLog = logs.find(
          (log) => log.module === 'SessionValidator',
        )

        const requestLog = logs.find(
          (log) =>
            log.res &&
            log.req?.url === '/users/me',
        )

        expect(sessionLog).toMatchObject({
          level: 'warn',
          module: 'SessionValidator',
          event: 'Session.Validate',
          operation: 'session',
          req: {
            method: 'GET',
            url: '/users/me',
          },
          message: 'Session validation failed: access token is missing',
        })

        expect(requestLog).toMatchObject({
          level: 'info',
          req: {
            method: 'GET',
            url: '/users/me',
          },
          res: {
            statusCode: HttpStatus.UNAUTHORIZED,
          },
        })
      })
    })
  })

  describe('CSRF validation', () => {
    it('logs a CSRF activation failure', async () => {
      const user = await createUser(
        userRepository,
          {
              status: UserStatus.ACTIVE,
              role: UserRole.ADMIN,
          }
      )

      const { cookies } = await loginWithOtp(app, user)

      await withCapturedLogs(async (getLogs) => {
        const res = await app.inject({
          method: 'PATCH',
          url: '/users/me',
          cookies,
        })

        expect([
          HttpStatus.FORBIDDEN,
          HttpStatus.UNAUTHORIZED,
        ]).toContain(res.statusCode)

        const csrfLog = getLogs().find(
          (log) => log.module === 'CSRFGuard',
        )

        expect(csrfLog).toMatchObject({
          level: 'warn',
          module: 'CSRFGuard',
          req: {
            method: 'PATCH',
            url: '/users/me',
          },
          message: 'The csrf token is invalid or missing',
        })
      })
    })
  })

  describe('rate limiting', () => {
    it('logs when the global rate limit is exceeded', async () => {
      await withCapturedLogs(async (getLogs) => {
        const responses = await Promise.all(
          Array.from({ length: 101 }, () =>
            app.inject({
              method: 'POST',
              url: '/auth/login',
            }),
          ),
        )

        expect(
          responses.some(
            (res) => res.statusCode === HttpStatus.TOO_MANY_REQUESTS,
          ),
        ).toBe(true)

        const rateLimitLog = getLogs().find(
          (log) => log.module === 'CustomThrottlerGuard',
        )

        expect(rateLimitLog).toMatchObject({
          level: 'warn',
          module: 'CustomThrottlerGuard',
          req: {
            method: 'POST',
            url: '/auth/login',
          },
          message: 'Rate limit exceeded',
          data: {
            ttl: 30000,
            limit: 100,
            key: expect.any(String),
          },
        })
      })
    })
  })
})
