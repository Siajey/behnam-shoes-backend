import { ChangePasswordBody, LoginBody, SignUpBody } from '../dto'
import { UserResponse } from '@api/users/domain'
import { CookieModel } from '@common/api'

export interface ISignUp {
  execute(signUp: SignUpBody): Promise<string>
}

export interface ILogin {
  execute(loginBody: LoginBody): Promise<UserResponse>
}

export interface IVerifyUser {
  execute(token: string): Promise<void>
}

export interface IRefreshToken {
  execute(
    refreshToken: string,
  ): Promise<{ accessCookie: CookieModel; refreshCookie: CookieModel }>
}

export interface ICSRFToken {
  execute(): CookieModel[]
}

export interface IResetPassword {
  execute(resetBody: {
    resetToken: string
    newPassword: string
    confirmPassword: string
  }): Promise<void>
}

export interface ISendConfirmationLink {
  execute(email: string): Promise<void>
}

export interface IForgotPassword {
  execute(email: string): Promise<void>
}

export interface IChangePassword {
  execute(changePassword: ChangePasswordBody): Promise<void>
}

export interface ILogout {
  execute(userId: string): Promise<void>
}
