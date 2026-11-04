import {beforeAll, describe, expect, it} from '@jest/globals'
import {NestFastifyApplication} from '@nestjs/platform-fastify'

import {TestContext, testContextE2e} from './test-context.e2e'
import {IUserRepository, User} from '@api/users/domain'
import {deserializeCookies} from '@common/util'
import {ITokenService, JwtTokenService} from '@common/security'
import {JWT_TOKEN_SERVICE} from '@common/di'
import {createUser, loginWithOtp} from "../../util/test.util";

describe('Secret Rotation (e2e)', () => {
    let ctx: TestContext
    let app: NestFastifyApplication
    let userRepository: IUserRepository
    let user: User
    let initialCookies: any
    let initialCsrf: any
    let jwtTokenService: ITokenService
    beforeAll(async () => {
        ctx = await testContextE2e()
        app = ctx.app
        jwtTokenService = app.get<JwtTokenService>(JWT_TOKEN_SERVICE)
        userRepository = ctx.userRepository
        user = await createUser(userRepository)
        const {cookies, csrfToken} = await loginWithOtp(app, user)
        initialCookies = cookies
        initialCsrf = csrfToken
    })

    it('should refresh token with new and old secret and verify the new token is signed with new secret', async () => {
        // Rotate secrets

        process.env.REFRESH_TOKEN_SECRET_PREVIOUS =
            process.env.REFRESH_TOKEN_SECRET_CURRENT

        const newSecret = 'Xan0DnB3BjobgcqHFVpFBPOILECLe5Bjcx1vCvTrpKk'

        process.env.REFRESH_TOKEN_SECRET_CURRENT = newSecret

        const refreshRes = await app.inject({
            method: 'POST',
            url: '/auth/refresh-token',
            cookies:  initialCookies,
        })

        expect(refreshRes.statusCode).toBe(200)
        const refreshedCookies = deserializeCookies(
            refreshRes.headers['set-cookie'],
        )
        const newSignedRefreshToken = refreshedCookies['refresh_token']
        expect(
            jwtTokenService.verify(newSignedRefreshToken, newSecret),
        ).toMatchObject({
            identifier: user.id,
            iat: expect.any(Number),
            exp: expect.any(Number),
        })
    })
    it('should fail session with expired old secret', async () => {
        // Expire the previous secret

        const userResponse = await app.inject({
            url: '/users/me',
            method: 'GET',
            cookies: initialCookies,
        })
        expect(userResponse.statusCode).toBe(200)

        // Expiration process
        const newAccessSecret = 'xwZlqWfoJR+bYCGGv4JTTXIINnDQU4k59E/APRaRwmg='
        process.env.ACCESS_TOKEN_SECRET_PREVIOUS = null
        process.env.ACCESS_TOKEN_SECRET_CURRENT = newAccessSecret

        const res = await app.inject({
            method: 'GET',
            url: '/users/me',
           cookies: initialCookies,
        })
        expect(res.statusCode).toBe(401)
        expect(res.json().message).toBe(
            'The session token is invalid or has expired, please refresh your access token or login again',
        )
    })
})
