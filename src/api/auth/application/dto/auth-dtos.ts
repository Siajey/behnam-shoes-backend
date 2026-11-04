export interface RefreshTokenBody {
  refreshToken: string
  accessToken: string
}

export interface VerifyUserBody {
    phoneNumber: string
    otp: string
}

export interface OtpCredentialBody {
    phoneNumber: string
}

export interface LoginBody {
    loginMethod: string
    credentials: OtpCredentialBody
}