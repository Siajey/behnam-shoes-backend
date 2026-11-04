import { beforeAll, describe,it,expect } from '@jest/globals'
import { NestFastifyApplication } from '@nestjs/platform-fastify'

import { TestContext, testContextE2e } from './test-context.e2e'

describe('RateLimiter (e2e)', () => {
  let ctx: TestContext
  let app: NestFastifyApplication
  beforeAll(async () => {
    ctx = await testContextE2e()
    app = ctx.app
  })

  it('should fail by rate limiter if too many requests (100) received', async () => {
    const makeRequest = () =>
      app.inject({
        method: 'POST',
        url: '/auth/login',
      })

    const promises: Promise<any>[] = []
    for (let i = 0; i <= 101; i++) {
      promises.push(makeRequest())
    }
    await Promise.all(promises)
    const lastRequest = await makeRequest()
    expect(lastRequest.json().code).toBe('TOO_MANY_REQUESTS')
  })
})
