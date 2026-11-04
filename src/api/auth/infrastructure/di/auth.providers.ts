import {
    AUTH_TOKEN_SERVICE,
    CONFIG_PROVIDER,
    CREATE_OTP_USE_CASE,
    createProvider,
    CSRF_TOKEN_USE_CASE,
    JWT_TOKEN_SERVICE,
    OTP_LOGIN,
    LOGIN,
    LOGOUT,
    REFRESH_TOKEN,
    SEND_LOGIN_OTP,
    SESSION_CACHE_SERVICE, SMS_SERVICE,
    USER_REPOSITORY, VERIFY_OTP_USE_CASE,
    VERIFY_USER_OTP,
} from '@common/di'
import {
    CsrfTokenUsecase,
    OtpStrategy,
    LoginUsecase,
    LogoutUseCase,
    RefreshTokenUsecase,
    VerifyUserUseCase,
    SendLoginOtpUsecase
} from '@api/auth/application'

export const AuthProviders = [
    createProvider<VerifyUserUseCase>(VERIFY_USER_OTP, VerifyUserUseCase, [
        USER_REPOSITORY,
        VERIFY_OTP_USE_CASE,
        SESSION_CACHE_SERVICE
    ]),
    createProvider<RefreshTokenUsecase>(REFRESH_TOKEN, RefreshTokenUsecase, [
        JWT_TOKEN_SERVICE,
        AUTH_TOKEN_SERVICE,
        CONFIG_PROVIDER,
    ]),
    createProvider<CsrfTokenUsecase>(CSRF_TOKEN_USE_CASE, CsrfTokenUsecase, [
        AUTH_TOKEN_SERVICE,
        CONFIG_PROVIDER,
    ]),
    createProvider<SendLoginOtpUsecase>(
        SEND_LOGIN_OTP,
        SendLoginOtpUsecase,
        [USER_REPOSITORY, CREATE_OTP_USE_CASE, SMS_SERVICE, CONFIG_PROVIDER],
    ),
    createProvider<LogoutUseCase>(LOGOUT, LogoutUseCase, [
        SESSION_CACHE_SERVICE,
        USER_REPOSITORY,
    ]),
    createProvider<OtpStrategy>(OTP_LOGIN, OtpStrategy, [
        USER_REPOSITORY,
        CREATE_OTP_USE_CASE,
        SMS_SERVICE,
        CONFIG_PROVIDER
    ]),
    createProvider<LoginUsecase>(LOGIN, LoginUsecase, [
        OTP_LOGIN,
        SESSION_CACHE_SERVICE,
    ]),
]
