import { beforeAll, describe, expect, it } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'

import { TestContext, testContextE2e } from './test-context.e2e'

describe('Security (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
  })

  it('/auth/login (POST) should fail with missing credentials', async () => {
    const result = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        loginMethod: 'otp',
      },
    })

    expect(result.statusCode).toBe(400)
    const body = JSON.parse(result.payload)
    expect(body).toMatchObject({
      code: 'VALIDATION_ERROR',
      path: '/auth/login',
      message: 'credentials is required',
    })
  })

  it('should allow CORS for whitelisted origin', async () => {
    const allowedOrigin = 'https://behnam-shoes.com'

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
