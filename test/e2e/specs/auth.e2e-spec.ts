import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {beforeAll, describe, expect, it} from '@jest/globals'

import {TestContext, testContextE2e} from './test-context.e2e'
import {IUserRepository, User, UserRole, UserStatus} from '@api/users/domain'
import {deserializeCookies} from '@common/util'

const OTP = '12345'
const WRONG_OTP = '00000'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('AuthController (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let userRepository: IUserRepository

    const newPhone = () =>
        `09${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`

    const createUser = async (status = UserStatus.ACTIVE) => {
        const phoneNumber = newPhone()
        await userRepository.save({
            phoneNumber,
            status,
            role: UserRole.USER,
            createdAt: new Date(),
        } as User)
        return phoneNumber
    }

    const requestOtp = (phoneNumber: string) =>
        app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: {loginMethod: 'otp', credentials: {phoneNumber}},
        })

    const verifyOtp = (phoneNumber: string, otp: string) =>
        app.inject({
            method: 'POST',
            url: '/auth/verify-login-otp',
            payload: {phoneNumber, otp},
        })

    const loginWithOtp = async () => {
        const phoneNumber = await createUser()
        await requestOtp(phoneNumber)
        const res = await verifyOtp(phoneNumber, OTP)
        const setCookie = res.headers['set-cookie'] as string[]
        return {
            phoneNumber,
            res,
            setCookie,
            cookies: deserializeCookies(setCookie),
            csrfToken: res.json().data.csrfToken as string,
        }
    }

    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        userRepository = ctx.userRepository
    })

    describe('POST /auth/login (otp)', () => {
        it('sends an OTP to an existing user', async () => {
            const res = await requestOtp(await createUser())

            expect(res.statusCode).toBe(200)
            expect(res.json()).toMatchObject({
                code: 'OTP_SENT_SUCCESS',
                path: '/auth/login',
                data: null,
            })
        })

        it('rejects an invalid phone number', async () => {
            const res = await requestOtp('12345')

            expect(res.statusCode).toBe(400)
            expect(res.json().code).toBe('VALIDATION_ERROR')
        })

        it('rejects an unknown login method', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: {
                    loginMethod: 'carrier-pigeon',
                    credentials: {phoneNumber: newPhone()},
                },
            })

            expect(res.statusCode).toBe(400)
        })
    })

    describe('GET /auth/send-login-otp/:phoneNumber', () => {
        it('re-sends an OTP', async () => {
            const phoneNumber = await createUser()
            const res = await app.inject({
                method: 'GET',
                url: `/auth/send-login-otp/${phoneNumber}`,
            })

            expect(res.statusCode).toBe(200)
            expect(res.json()).toMatchObject({
                code: 'RESEND_LOGIN_OTP_SUCCESS',
                path: `/auth/send-login-otp/${phoneNumber}`,
                data: null,
            })
        })

        it('rejects an invalid phone number', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/auth/send-login-otp/not-a-phone',
            })
            expect(res.statusCode).toBe(404)
        })
    })

    describe('POST /auth/verify-login-otp', () => {
        it('logs in with the correct OTP and sets the session cookies', async () => {
            const {res, setCookie, cookies, csrfToken} = await loginWithOtp()

            expect(res.statusCode).toBe(200)
            expect(res.json()).toMatchObject({
                code: 'verifyUserSuccess',
                path: '/auth/verify-login-otp',
            })
            expect(typeof csrfToken).toBe('string')
            expect(csrfToken.length).toBeGreaterThan(20)

            expect(cookies['access_token']).toBeDefined()
            expect(cookies['refresh_token']).toBeDefined()

            for (const name of ['access_token', 'refresh_token'])
                expect(setCookie.find((c) => c.startsWith(`${name}=`))).toMatch(
                    /HttpOnly/i,
                )
        })

        it('the session cookies give access to a protected route', async () => {
            const {phoneNumber, cookies} = await loginWithOtp()

            const me = await app.inject({method: 'GET', url: '/users/me', cookies})

            expect(me.statusCode).toBe(200)
            expect(me.json().data.phoneNumber).toBe(phoneNumber)
        })

        it('rejects a wrong OTP and sets no session cookies', async () => {
            const phoneNumber = await createUser()
            await requestOtp(phoneNumber)

            const res = await verifyOtp(phoneNumber, WRONG_OTP)

            expect([400, 401]).toContain(res.statusCode)
            expect(
                deserializeCookies(res.headers['set-cookie'] as any)?.['access_token'],
            ).toBeUndefined()
        })

        it('rejects an OTP that was never requested for this phone number', async () => {
            const res = await verifyOtp(await createUser(), OTP)

            expect([400, 401]).toContain(res.statusCode)
        })

        it('rejects a malformed body', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/auth/verify-login-otp',
                payload: {},
            })

            expect(res.statusCode).toBe(400)
            expect(res.json().code).toBe('VALIDATION_ERROR')
        })
    })

    describe('POST /auth/csrf-token', () => {
        it('returns a CSRF token and sets the csrf cookies', async () => {
            const res = await app.inject({method: 'POST', url: '/auth/csrf-token'})

            expect(res.statusCode).toBe(200)
            expect(res.json()).toMatchObject({
                code: 'CSRF_TOKEN_SUCCESS',
                path: '/auth/csrf-token',
            })
            expect(res.json().data.csrfToken.length).toBeGreaterThan(20)

            const cookies = deserializeCookies(res.headers['set-cookie'] as any)
            expect(cookies['csrf_secret'].length).toBeGreaterThan(20)
        })
    })

    describe('POST /auth/refresh-token', () => {
        it('issues new access and refresh tokens', async () => {
            const phoneNumber = await createUser()
            await requestOtp(phoneNumber)
            const res = await verifyOtp(phoneNumber, OTP)
            const setCookie = res.headers['set-cookie'] as string[]
            const cookies = deserializeCookies(setCookie)
            await sleep(1100)

            const refreshRes = await app.inject({
                method: 'POST',
                url: '/auth/refresh-token',
                cookies,
            })

            expect(refreshRes.statusCode).toBe(200)
            expect(refreshRes.json()).toMatchObject({
                code: 'TOKENS_REFRESHED_SUCCESS',
                path: '/auth/refresh-token',
                data: null,
            })

            const refreshed = deserializeCookies(refreshRes.headers['set-cookie'] as any)
            expect(refreshed['access_token']).toBeDefined()
            expect(refreshed['refresh_token']).toBeDefined()
            expect(refreshed['access_token']).not.toEqual(cookies['access_token'])
            expect(refreshed['refresh_token']).not.toEqual(cookies['refresh_token'])
        }, 10000)

        it('rejects a request without a refresh cookie', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/auth/refresh-token',
            })

            expect(res.statusCode).toBe(401)
        })
    })

    describe('POST /auth/logout', () => {
        it('logs out, clears the cookies and invalidates the session', async () => {
            const {cookies, csrfToken} = await loginWithOtp()

            const before = await app.inject({method: 'GET', url: '/users/me', cookies})
            expect(before.statusCode).toBe(200)

            const res = await app.inject({
                method: 'POST',
                url: '/auth/logout',
                cookies,
                headers: {'x-csrf-token': csrfToken},
            })

            expect(res.statusCode).toBe(200)
            expect(res.json()).toMatchObject({
                code: 'LOGOUT_SUCCESS',
                path: '/auth/logout',
                data: null,
            })

            const cleared = deserializeCookies(res.headers['set-cookie'] as any)
            for (const name of ['access_token', 'refresh_token', 'csrf_token', 'csrf_secret'])
                expect(cleared[name]).toBeFalsy()

            const after = await app.inject({method: 'GET', url: '/users/me', cookies})
            expect([401, 403]).toContain(after.statusCode)
        })

        it('rejects logout without the CSRF header', async () => {
            const {cookies} = await loginWithOtp()

            const res = await app.inject({method: 'POST', url: '/auth/logout', cookies})

            expect([401, 403]).toContain(res.statusCode)
        })

        it('rejects logout without a session', async () => {
            const res = await app.inject({method: 'POST', url: '/auth/logout'})

            expect([401, 403]).toContain(res.statusCode)
        })
    })
})