import { beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'
import { HttpStatus } from '@nestjs/common'

import { TestContext, testContextE2e } from './test-context.e2e'
import { IUserRepository } from '@user/domain'
import { USER_REPOSITORY } from '@common/di'
import { testLogInAdmin } from '../../util/test.util'

describe('HealthController (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  let userRepository: IUserRepository
  let loggedInCookies: any

  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
    userRepository = app.get(USER_REPOSITORY)
    await testLogInAdmin(userRepository, app).then((authenticated) => {
      loggedInCookies = authenticated.loggedInCookies
    })
  })

  it('/health/live (GET) should return ok', async () => {
    const res = await app.inject({
      url: '/health/live',
      method: 'GET',
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    expect(res.json()).toEqual({ status: 'ok' })
  })

  it('/health/public (GET) should return database status', async () => {
    const res = await app.inject({
      url: '/health/public',
      method: 'GET',
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.status).toBeDefined()
    expect(body.details).toBeDefined()
    expect(body.details.database).toBeDefined()
  })

  it.skip('/health/ready (GET) should return readiness info (admin only)', async () => {
    const res = await app.inject({
      url: '/health/ready',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })
    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.details).toHaveProperty('database')
  })

  it('/health/database (GET) should return database health (admin only)', async () => {
    const res = await app.inject({
      url: '/health/database',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.details).toHaveProperty('database')
  })

  it('/health/disk (GET) should return disk health (admin only)', async () => {
    const res = await app.inject({
      url: '/health/disk',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.details).toHaveProperty('storage')
  })

  it.skip('/health/memory (GET) should return memory health (admin only)', async () => {
    const res = await app.inject({
      url: '/health/memory',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.details).toHaveProperty('memory_heap')
  })

  it('/health/redis (GET) should return redis health (admin only)', async () => {
    const res = await app.inject({
      url: '/health/redis',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.details).toHaveProperty('redis')
  })

  it('/health/cloud-storage (GET) should return cloud storage connection health (admin only)', async () => {
    const res = await app.inject({
      url: '/health/cloud-storage',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.status).toBe('ok')
  })

  it('/health/email-service (GET) should verify email service connection health (admin only)', async () => {
    const res = await app.inject({
      url: '/health/email-service',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect(res.statusCode).toBe(HttpStatus.OK)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.info).toHaveProperty('emailSender')
    expect(body.info.emailSender.status).toBe('up')
  })

  it('/health/external (GET) should check frontend and resender (admin only)', async () => {
    const res = await app.inject({
      url: '/health/external',
      method: 'GET',
      headers: {
        'set-cookie': loggedInCookies,
      },
    })

    expect([HttpStatus.OK, HttpStatus.SERVICE_UNAVAILABLE]).toContain(
      res.statusCode,
    )
    const body = res.json()
    expect(body.status).toBeDefined()
    expect(body.details).toBeDefined()
    expect(body.details).toHaveProperty('emailSender')
  })
})
