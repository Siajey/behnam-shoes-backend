import { beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import * as bcrypt from 'bcryptjs'

import { TestContext, testContextE2e } from './test-context.e2e'
import { User, UserRole, UserStatus } from '@user/domain'
import { deserializeCookies } from '@common/util'
import { generateRandomUsername } from '../../util/test.util'

describe('Security (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
  })

  it('/auth/sign-up (POST) should fail with invalid email format', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/auth/sign-up',
      payload: {
        email: 'not-an-email',
        username: generateRandomUsername(),
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!',
      },
    })

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.payload)

    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      path: '/auth/sign-up',
      message: expect.stringMatching('Please provide a valid email'),
    })
  })

  it('/auth/sign-up (POST) should fail with weak password (missing uppercase and number)', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/auth/sign-up',
      payload: {
        email: `test+${Date.now()}@example.com`,
        password: 'weakpass',
        confirmPassword: 'weakpass',
      },
    })

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.payload)

    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      path: '/auth/sign-up',
    })
    expect(body.message).toEqual(
      expect.stringMatching(
        'username is required, password: Password must contain at least one uppercase letter., password: Password must contain at least one number.',
      ),
    )
  })

  it('/auth/login (POST) should fail with missing credentials', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        loginMethod: 'local',
      },
    })

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.payload)
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      path: '/auth/login',
      message: 'emailOrUsername is required, password is required',
    })
  })

  it('/auth/change-password (POST) should fail if access token is missing', async () => {
    const email = `test+${Date.now()}@example.com`
    const password = 'Password123!'
    const userRepository = ctx.userRepository
    const hashed = await bcrypt.hash(password, 10)
    await userRepository.save({
      email: email,
      username: generateRandomUsername(),
      passwordHash: hashed,
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      createdAt: new Date(),
    } as User)

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: email,
        password,
      },
    })
    const cookies = loginRes.headers['set-cookie']
    const csrfToken =
      loginRes.cookies?.['csrf_token'] ||
      deserializeCookies(cookies)['csrf_token']
    const parsedCookies = Array.isArray(cookies)
      ? cookies.filter((cookie) => !cookie.startsWith('access_token'))
      : null
    const result = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!',
      },
      headers: {
        'set-cookie': parsedCookies,
        'x-csrf-token': csrfToken,
      },
    })
    expect(result.statusCode).toBe(401)
    const body = JSON.parse(result.payload)
    expect(body).toMatchObject({
      code: 'AccessTokenMissing',
      message: expect.stringMatching(
        'The session token is missing, please refresh your access token or login again',
      ),
      path: '/auth/change-password',
    })
  })

  it('/auth/change-password (POST) should fail if CSRF token is missing or invalid', async () => {
    const email = `test+${Date.now()}@example.com`
    const password = 'Password123!'

    const userRepository = ctx.userRepository
    const hashed = await bcrypt.hash(password, 10)

    await userRepository.save({
      email: email,
      username: generateRandomUsername(),
      passwordHash: hashed,
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      createdAt: new Date(),
    } as User)

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: email,
        password,
      },
    })

    const cookies = loginRes.headers['set-cookie']
    expect(cookies).toBeDefined()

    const result = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!',
      },
      headers: {
        'set-cookie': cookies,
        // missing or invalid 'x-csrf-token'
      },
    })
    expect(result.statusCode).toBe(403)
    const body = JSON.parse(result.payload)
    expect(body).toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Security check failed – please refresh the page or login again',
      path: '/auth/change-password',
    })
  })

  it('/auth/change-password (POST) should fail if user has changed password or role and access token is expired', async () => {
    const email = `test+${Date.now()}@example.com`
    const password = 'Password123!'
    const userRepository = ctx.userRepository
    const hashed = await bcrypt.hash(password, 10)
    await userRepository.save({
      email: email,
      username: generateRandomUsername(),
      passwordHash: hashed,
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      createdAt: new Date(),
    } as User)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: email,
        password,
      },
    })

    const cookies = loginRes.headers['set-cookie']
    const csrfToken =
      loginRes.cookies?.['csrf_token'] ||
      deserializeCookies(cookies)['csrf_token']
    expect(cookies).toBeDefined()
    await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!',
      },
      headers: {
        'set-cookie': cookies,
        'x-csrf-token': csrfToken,
      },
    })

    const result = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!',
      },
      headers: {
        'set-cookie': cookies,
        'x-csrf-token': csrfToken,
      },
    })
    expect(result.statusCode).toBe(401)
    const body = JSON.parse(result.payload)
    expect(body).toMatchObject({
      code: 'TokenStale',
      message: 'The session is stale, please login again',
      path: '/auth/change-password',
    })
  })

  it('/auth/change-password (POST) should fail if user send too many requests ( > 10 )', async () => {
    const email = `test+${Date.now()}@example.com`
    const password = 'Password123!'
    const userRepository = ctx.userRepository
    const hashed = await bcrypt.hash(password, 10)
    await userRepository.save({
      email: email,
      username: generateRandomUsername(),
      passwordHash: hashed,
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      createdAt: new Date(),
    } as User)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: email,
        password,
      },
    })
    const cookies = loginRes.headers['set-cookie']
    const csrfToken =
      loginRes.cookies?.['csrf_token'] ||
      deserializeCookies(cookies)['csrf_token']
    expect(cookies).toBeDefined()
    for (let i = 0; i < 12; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        payload: {
          currentPassword: password,
          newPassword: 'NewPassword456!',
          confirmPassword: 'NewPassword456!',
        },
        headers: {
          'set-cookie': cookies,
          'x-csrf-token': csrfToken,
        },
      })
    }
    const result = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: password,
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!',
      },
      headers: {
        'set-cookie': cookies,
        'x-csrf-token': csrfToken,
      },
    })
    expect(result.statusCode).toBe(429)
    const body = JSON.parse(result.payload)
    expect(body).toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message:
        'You are sending too many requests. Please wait and try again later.',
      path: '/auth/change-password',
    })
  })

  it('should allow CORS for whitelisted origin', async () => {
    const allowedOrigin = 'https://zalvolt.com'

    const result = await app.inject({
      method: 'OPTIONS',
      url: '/auth/login',
      headers: {
        Origin: allowedOrigin,
        'Access-Control-Request-Method': 'POST',
      },
    })
    expect(result.statusCode).toBe(204) // Fastify handles preflight like this
    expect(result.headers['access-control-allow-origin']).toBe(allowedOrigin)
    expect(result.headers['access-control-allow-credentials']).toBe('true')
  })

  it('should apply security headers from Helmet config', async () => {
    const result = await app.inject({
      method: 'GET',
      url: '/auth/login',
    })

    expect(result.headers['x-dns-prefetch-control']).toBe('off')
    expect(result.headers['x-frame-options']).toBeDefined()
    expect(result.headers['x-content-type-options']).toBe('nosniff')
    expect(result.headers['referrer-policy']).toBeDefined()
    expect(result.headers['x-xss-protection']).toBeDefined()
    expect(result.headers['content-security-policy']).toContain(
      "default-src 'self'",
    )
  })
})
