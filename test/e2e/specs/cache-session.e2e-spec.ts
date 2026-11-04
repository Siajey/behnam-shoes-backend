import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {beforeAll, describe, expect, it} from '@jest/globals'
import {HttpStatus} from '@nestjs/common'

import {TestContext, testContextE2e} from './test-context.e2e'
import {SESSION_CACHE_SERVICE} from '@common/di'
import {SessionCacheService} from '@api/session/application'
import {IUserRepository, User, UserRole, UserStatus} from '@api/users/domain'
import {createUser, loginWithOtp, requestOtp, verifyOtp, WRONG_OTP} from "../../util/test.util";

describe('Session cache (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let userRepository: IUserRepository
    let sessionCache: SessionCacheService

    const expectedSession = (user: User) => ({
        updatedAt: expect.any(String),
        status: user.status,
        role: user.role,
    })

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = ctx.userRepository
        sessionCache = ctx.app.get(SESSION_CACHE_SERVICE)
    })

    describe('caching on login', () => {
        it('has no cached session before the user logs in', async () => {
            const user = await createUser(userRepository)

            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })

        it('does not cache a session when only an OTP is requested', async () => {
            const user = await createUser(userRepository)

            await requestOtp(app, user.phoneNumber)

            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })

        it('caches the session after a successful OTP login', async () => {
            const user = await createUser(userRepository)

            const {res} = await loginWithOtp(app, user)

            expect(res.statusCode).toBe(200)
            expect(await sessionCache.getUserSession(user.id)).toMatchObject(
                expectedSession(user),
            )
        })

        it.each([UserRole.USER, UserRole.ADMIN])(
            'caches the %s role and the active status',
            async (role) => {
                const user = await createUser(userRepository, {
                    status: UserStatus.ACTIVE,
                    role
                })

                await loginWithOtp(app, user)

                expect(await sessionCache.getUserSession(user.id)).toMatchObject({
                    role,
                    status: UserStatus.ACTIVE,
                    updatedAt: expect.any(String),
                })
            },
        )

        it('does not cache a session after a wrong OTP', async () => {
            const user = await createUser(userRepository)
            await requestOtp(app, user.phoneNumber)

            const res = await verifyOtp(app, user.phoneNumber, WRONG_OTP)

            expect([400, 401]).toContain(res.statusCode)
            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })
    })

    describe('invalidation', () => {
        it('invalidates the cache after logout', async () => {
            const user = await createUser(userRepository)
            const {cookies, csrfToken} = await loginWithOtp(app, user)
            expect(await sessionCache.getUserSession(user.id)).toMatchObject(
                expectedSession(user),
            )

            const res = await app.inject({
                method: 'POST',
                url: '/auth/logout',
                cookies,
                headers: {'x-csrf-token': csrfToken},
            })

            expect(res.statusCode).toBe(200)
            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()

            const after = await app.inject({method: 'GET', url: '/users/me', cookies})
            expect([401, 403]).toContain(after.statusCode)
        })

        it('does not invalidate the cache when logout is rejected', async () => {
            const user = await createUser(userRepository)
            const {cookies} = await loginWithOtp(app, user)

            const res = await app.inject({method: 'POST', url: '/auth/logout', cookies})

            expect([401, 403]).toContain(res.statusCode)
            expect(await sessionCache.getUserSession(user.id)).toMatchObject(
                expectedSession(user),
            )
        })

        it('invalidates the cache after the user deletes their account', async () => {
            const user = await createUser(userRepository)
            const {cookies, csrfToken} = await loginWithOtp(app, user)
            expect(await sessionCache.getUserSession(user.id)).toMatchObject(
                expectedSession(user),
            )

            const res = await app.inject({
                method: 'DELETE',
                url: '/users/me',
                cookies,
                headers: {'x-csrf-token': csrfToken},
            })

            expect(res.statusCode).toBe(HttpStatus.NO_CONTENT)
            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })

        it('invalidates the cache after an admin changes the user role or status', async () => {
            const user = await createUser(userRepository, {status: UserStatus.ACTIVE})
            await loginWithOtp(app, user)
            expect(await sessionCache.getUserSession(user.id)).toMatchObject(
                expectedSession(user),
            )

            const admin = await createUser(userRepository, {status: UserStatus.ACTIVE, role: UserRole.ADMIN})
            const adminLogin = await loginWithOtp(app, admin)

            const res = await app.inject({
                method: 'PATCH',
                url: `/users/${user.id}`,
                cookies: adminLogin.cookies,
                headers: {'x-csrf-token': adminLogin.csrfToken},
                body: {
                    status: 'inactive'
                }
            })
            console.log(res.json())

            expect(res.statusCode).toBe(HttpStatus.OK)
            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })

        it('invalidates the cache after an admin deletes the user', async () => {
            const user = await createUser(userRepository, {status: UserStatus.ACTIVE})
            await loginWithOtp(app, user)
            expect(await sessionCache.getUserSession(user.id)).toMatchObject(
                expectedSession(user),
            )

            const admin = await createUser(userRepository, {status: UserStatus.ACTIVE, role: UserRole.ADMIN})
            const adminLogin = await loginWithOtp(app, admin)

            const res = await app.inject({
                method: 'DELETE',
                url: `/users/${user.id}`,
                cookies: adminLogin.cookies,
                headers: {'x-csrf-token': adminLogin.csrfToken},
            })
            expect(res.statusCode).toBe(HttpStatus.NO_CONTENT)
            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })
    })
})