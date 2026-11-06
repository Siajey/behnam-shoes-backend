import {NestFastifyApplication} from "@nestjs/platform-fastify";

import {IUserRepository, User, UserRole, UserStatus} from "@api/users/domain";
import {deserializeCookies} from "@common/util";


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
