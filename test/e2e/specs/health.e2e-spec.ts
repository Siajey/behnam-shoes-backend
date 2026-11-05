import {afterEach, beforeAll, describe, expect, it, jest} from '@jest/globals'
import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {HttpStatus} from '@nestjs/common'

import {TestContext, testContextE2e} from './test-context.e2e'
import {IUserRepository, UserRole} from '@api/users/domain'
import {USER_REPOSITORY} from '@common/di'
import {DatabaseHealthIndicator} from '@api/health/presentation'
import {createUser, loginWithOtp} from '../../util/test.util'

describe('HealthController (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let userRepository: IUserRepository
    let adminCookies: Record<string, string>
    let userCookies: Record<string, string>

    const get = (url: string, cookies?: Record<string, string>) =>
        app.inject({method: 'GET', url, cookies})

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = app.get(USER_REPOSITORY)

        const admin = await createUser(userRepository, {role: UserRole.ADMIN})
        adminCookies = (await loginWithOtp(app, admin)).cookies

        const user = await createUser(userRepository, {role: UserRole.USER})
        userCookies = (await loginWithOtp(app, user)).cookies
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('GET /health/live', () => {
        it('returns ok without authentication', async () => {
            const res = await get('/health/live')

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json()).toEqual({status: 'ok'})
        })
    })

    describe('GET /health/public', () => {
        let clockOffset = 0
        const jumpPastCache = () => {
            clockOffset += 60_000
            const real = Date.now()
            jest.spyOn(Date, 'now').mockReturnValue(real + clockOffset)
        }

        const databaseIndicator = () =>
            app.get(DatabaseHealthIndicator, {strict: false})

        it('returns only a status, with no details', async () => {
            jumpPastCache()

            const res = await get('/health/public')

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(res.json()).toEqual({status: 'ok'})
        })

        it('does not require authentication', async () => {
            jumpPastCache()

            const res = await get('/health/public')

            expect(res.statusCode).toBe(HttpStatus.OK)
        })

        it('answers repeated probes from one database check', async () => {
            jumpPastCache()
            const spy = jest.spyOn(databaseIndicator(), 'isHealthy')

            await Promise.all([
                get('/health/public'),
                get('/health/public'),
                get('/health/public'),
            ])
            await get('/health/public')

            expect(spy).toHaveBeenCalledTimes(1)
        })

        it('returns 503 without leaking the failure reason when the database is down', async () => {
            jumpPastCache()
            jest
                .spyOn(databaseIndicator(), 'isHealthy')
                .mockRejectedValue(new Error('boom: password authentication failed for user "app"'))

            const res = await get('/health/public')

            expect(res.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE)
            expect(res.body).not.toContain('boom')
            expect(res.body).not.toContain('password')
        })

        it('recovers once the database is healthy again and the cache has expired', async () => {
            jumpPastCache()
            jest
                .spyOn(databaseIndicator(), 'isHealthy')
                .mockRejectedValueOnce(new Error('down'))
            expect((await get('/health/public')).statusCode).toBe(
                HttpStatus.SERVICE_UNAVAILABLE,
            )

            jest.restoreAllMocks()
            jumpPastCache()

            expect((await get('/health/public')).statusCode).toBe(HttpStatus.OK)
        })
    })

    describe('admin routes', () => {
        const adminRoutes: Array<{ url: string; details: string[] }> = [
            {
                url: '/health/ready',
                details: ['database', 'storage', 'memory_heap', 'redis'],
            },
            {url: '/health/database', details: ['database']},
            {url: '/health/disk', details: ['storage']},
            {url: '/health/memory', details: ['memory_heap']},
            {url: '/health/redis', details: ['redis']},
        ]

        describe.each(adminRoutes)('GET $url', ({url, details}) => {
            it('returns the health details for an admin', async () => {
                const res = await get(url, adminCookies)

                expect(res.statusCode).toBe(HttpStatus.OK)
                const body = res.json()
                expect(body.status).toBe('ok')
                for (const name of details) {
                    expect(body.details).toHaveProperty(name)
                    expect(body.details[name].status).toBe('up')
                }
            })

            it('rejects a request without a session', async () => {
                const res = await get(url)

                expect([HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN]).toContain(
                    res.statusCode,
                )
            })

            it('rejects a non-admin user', async () => {
                const res = await get(url, userCookies)

                expect(res.statusCode).toBe(HttpStatus.FORBIDDEN)
            })
        })

        it('/health/ready reports an unhealthy dependency', async () => {
            jest
                .spyOn(app.get(DatabaseHealthIndicator, {strict: false}), 'isHealthy')
                .mockResolvedValue({database: {status: 'down', message: 'db down'}})

            const res = await get('/health/ready', adminCookies)

            expect(res.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE)
            expect(res.body).toContain('database')
        })
    })
})