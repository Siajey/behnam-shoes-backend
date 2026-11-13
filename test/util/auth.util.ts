import {NestFastifyApplication} from '@nestjs/platform-fastify'

import {IUserRepository, User, UserRole, UserStatus} from '@api/users/domain'
import {deserializeCookies} from '@common/util'

import type {TestContext} from '../e2e/specs/test-context.e2e'
import {Api, Session} from './api.util'

export const OTP = '123456'
export const WRONG_OTP = '00000'

export const newPhone = () =>
    `09${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`

export const createUser = (
    userRepository: IUserRepository,
    user?: Partial<User>
) =>
    userRepository.save({
        phoneNumber: newPhone(),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
        createdAt: new Date(),
        ...user
    } as User)

export const requestOtp = (app: NestFastifyApplication, phoneNumber: string) =>
    app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {loginMethod: 'otp', credentials: {phoneNumber}},
    })

export const verifyOtp = (app: NestFastifyApplication, phoneNumber: string, otp: string) =>
    app.inject({
        method: 'POST',
        url: '/auth/verify-login-otp',
        payload: {phoneNumber, otp},
    })

export const loginWithOtp = async (app: NestFastifyApplication, user: User) => {
    await requestOtp(app, user.phoneNumber)
    const res = await verifyOtp(app, user.phoneNumber, OTP)
    const setCookie = res.headers['set-cookie'] as string[]
    return {
        phoneNumber: user.phoneNumber,
        res,
        setCookie,
        cookies: deserializeCookies(setCookie),
        csrfToken: res.json().data.csrfToken as string
    }
}

export interface UserSession {
    session: Session
    userId: string
    api: Api
}

/** Creates a user, logs in with OTP and returns the session, the user id and a ready-to-use `Api`. */
export const createUserSession = async (
    ctx: TestContext,
    role: UserRole = UserRole.USER,
): Promise<UserSession> => {
    const user = await createUser(ctx.userRepository, {
        phoneNumber: newPhone(),
        role,
        status: UserStatus.ACTIVE,
    })
    const {cookies, csrfToken} = await loginWithOtp(ctx.app, user)
    const session: Session = {cookies, csrfToken}
    return {session, userId: user.id as string, api: new Api(ctx.app, session)}
}

/** Same as `createUserSession` when only the cookies and CSRF token are needed. */
export const createSession = async (
    ctx: TestContext,
    role: UserRole = UserRole.USER,
): Promise<Session> => (await createUserSession(ctx, role)).session
