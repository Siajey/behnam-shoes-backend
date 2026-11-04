import { beforeAll, describe, expect } from '@jest/globals'
import { TestContext, testContextE2e } from './test-context.e2e'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { SESSION_CACHE_SERVICE } from '@common/di'
import * as bcrypt from 'bcryptjs'

import { User, UserResponse, UserRole, UserStatus } from '@user/domain'
import { createUniqueUsername, delay } from '../../util/test.util'
import { SessionCacheService } from '@session/application'
import { deserializeCookies } from '@common/util'
import { HttpStatus } from '@nestjs/common'

describe('Session (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let sessionCacheService: SessionCacheService
  let user: UserResponse
  let password = 'Poiuytrewq1'
  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    sessionCacheService = ctx.app.get(SESSION_CACHE_SERVICE)
    const hashedPass = await bcrypt.hash(password, 10)
    user = await ctx.userRepository.save({
      email: 'user@gmail.com',
      username: createUniqueUsername(),
      passwordHash: hashedPass,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
    } as User)
  })

  it('Should cache user session after login', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: 'user@gmail.com',
        password: password,
      },
    })
    const cachedObj = await sessionCacheService.getUserSession(user.id)
    expect(cachedObj).toMatchObject({
      updatedAt: expect.any(String),
      status: 'active',
      role: 'admin',
    })
  })

  it('Should invalidate cache after change password', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: user.email,
        password: password,
      },
    })

    const cookies = loginRes.headers['set-cookie']
    const csrfToken =
      loginRes.cookies?.['csrf_token'] ||
      deserializeCookies(cookies)['csrf_token']
    expect(cookies).toBeDefined()
    const newPass = 'POiuytrewq1'
    const changeRes = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      payload: {
        currentPassword: password,
        newPassword: newPass,
        confirmPassword: newPass,
      },
      headers: {
        'x-csrf-token': csrfToken,
        'set-cookie': cookies,
      },
    })
    expect(changeRes.statusCode).toBe(200)
    password = newPass
    const cachedObj = await sessionCacheService.getUserSession(user.id)
    expect(cachedObj).toBeUndefined()
  })

  it('Should invalidate cache after logout', async () => {
    await delay(1000)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: user.email,
        password: password,
      },
    })

    let cachedObj = await sessionCacheService.getUserSession(user.id)

    expect(cachedObj).toMatchObject({
      updatedAt: expect.any(String),
      status: 'active',
      role: 'admin',
    })
    const cookies = loginRes.headers['set-cookie']
    const csrfToken =
      loginRes.cookies?.['csrf_token'] ||
      deserializeCookies(cookies)['csrf_token']
    expect(cookies).toBeDefined()

    const changeRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: {
        'x-csrf-token': csrfToken,
        'set-cookie': cookies,
      },
    })
    expect(changeRes.statusCode).toBe(200)

    cachedObj = await sessionCacheService.getUserSession(user.id)
    expect(cachedObj).toBeUndefined()
  })

  it('Should invalidate cache after delete me', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        emailOrUsername: user.email,
        password: password,
      },
    })
    await delay(1000)
    let cachedObj = await sessionCacheService.getUserSession(user.id)
    expect(cachedObj).toMatchObject({
      updatedAt: expect.any(String),
      status: 'active',
      role: 'admin',
    })

    const cookies = loginRes.headers['set-cookie']
    const csrfToken =
      loginRes.cookies?.['csrf_token'] ||
      deserializeCookies(cookies)['csrf_token']
    expect(cookies).toBeDefined()

    const res = await app.inject({
      url: '/users/me',
      method: 'DELETE',
      headers: {
        'set-cookie': cookies,
        'x-csrf-token': csrfToken,
      },
    })
    expect(res.statusCode).toBe(HttpStatus.NO_CONTENT)

    cachedObj = await sessionCacheService.getUserSession(user.id)
    expect(cachedObj).toBeUndefined()
  })
})
