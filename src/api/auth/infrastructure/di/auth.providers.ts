import {
  AUTH_TOKEN_SERVICE,
  CHANGE_PASSWORD,
  CONFIG_PROVIDER,
  createProvider,
  CSRF_TOKEN_USE_CASE,
  EMAIL_SERVICE,
  FORGOT_PASSWORD,
  HASH_GENERATOR,
  JWT_TOKEN_SERVICE,
  LOCAL_LOGIN,
  LOGIN,
  LOGOUT,
  PASSWORD_HASHER,
  REFRESH_TOKEN,
  RESET_PASSWORD,
  SEND_CONFIRMATION_EMAIL,
  SESSION_CACHE_SERVICE,
  SIGN_UP,
  USER_REPOSITORY,
  VERIFY_USER,
} from '@common/di'
import {
  ChangePassword,
  CsrfTokenUsecase,
  ForgotPasswordUsecase,
  LocalStrategy,
  LoginUsecase,
  LogoutUseCase,
  RefreshTokenUsecase,
  ResetPasswordUseCase,
  SignUpUseCase,
  VerifyUserUseCase,
} from '@api/auth/application'
import { GoogleStrategy } from '../login-strategy'
import { SendConfirmationLink } from '@api/auth/application/usecase/send-confirmation-link'

export const AuthProviders = [
  createProvider<VerifyUserUseCase>(VERIFY_USER, VerifyUserUseCase, [
    JWT_TOKEN_SERVICE,
    USER_REPOSITORY,
    CONFIG_PROVIDER,
  ]),
  GoogleStrategy,
  createProvider<SignUpUseCase>(SIGN_UP, SignUpUseCase, [
    JWT_TOKEN_SERVICE,
    CONFIG_PROVIDER,
    PASSWORD_HASHER,
    EMAIL_SERVICE,
    USER_REPOSITORY,
  ]),
  createProvider<LocalStrategy>(LOCAL_LOGIN, LocalStrategy, [
    USER_REPOSITORY,
    PASSWORD_HASHER,
  ]),
  createProvider<LoginUsecase>(LOGIN, LoginUsecase, [
    LOCAL_LOGIN,
    SESSION_CACHE_SERVICE,
  ]),
  createProvider<ForgotPasswordUsecase>(
    FORGOT_PASSWORD,
    ForgotPasswordUsecase,
    [USER_REPOSITORY, HASH_GENERATOR, CONFIG_PROVIDER, EMAIL_SERVICE],
  ),
  createProvider<ResetPasswordUseCase>(RESET_PASSWORD, ResetPasswordUseCase, [
    USER_REPOSITORY,
    HASH_GENERATOR,
    PASSWORD_HASHER,
  ]),
  createProvider<ChangePassword>(CHANGE_PASSWORD, ChangePassword, [
    USER_REPOSITORY,
    PASSWORD_HASHER,
    SESSION_CACHE_SERVICE,
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
  createProvider<SendConfirmationLink>(
    SEND_CONFIRMATION_EMAIL,
    SendConfirmationLink,
    [USER_REPOSITORY, JWT_TOKEN_SERVICE, EMAIL_SERVICE, CONFIG_PROVIDER],
  ),
  createProvider<LogoutUseCase>(LOGOUT, LogoutUseCase, [
    SESSION_CACHE_SERVICE,
    USER_REPOSITORY,
  ]),
]
