import {LoginBody, VerifyUserBody} from '../dto'
import {User} from '@api/users/domain'
import {CookieModel} from '@common/api'

export interface ILogin {
    execute(loginBody: LoginBody): Promise<User>
}

export interface IVerifyUser {
    execute(verifyUserBody: VerifyUserBody): Promise<User>
}

export interface IRefreshToken {
    execute(
        refreshToken: string,
    ): Promise<{ accessCookie: CookieModel; refreshCookie: CookieModel }>
}

export interface ICSRFToken {
    execute(): { cookie: CookieModel, csrfToken: string }
}

export interface ISendLoginOTP {
    execute(phoneNumber: string): Promise<void>
}

export interface ILogout {
    execute(userId: string): Promise<void>
}
