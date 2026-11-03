import {
  APP_LOGGER_SERVICE,
  AUTH_SESSION_VALIDATOR,
  AUTH_TOKEN_SERVICE,
  CACHE_MANAGER,
  CONFIG_PROVIDER,
  createProvider,
  HASH_GENERATOR,
  JWT_TOKEN_SERVICE,
  SESSION_CACHE_REPOSITORY,
  SESSION_CACHE_SERVICE,
  USER_REPOSITORY,
} from '@common/di'
import {
  SessionCacheService,
  SessionTokensService,
  SessionValidator,
} from '../application'
import { UserSessionCacheRepository } from '@api/auth/infrastructure'

export const SessionProviders = [
  createProvider<SessionValidator>(AUTH_SESSION_VALIDATOR, SessionValidator, [
    USER_REPOSITORY,
    JWT_TOKEN_SERVICE,
    CONFIG_PROVIDER,
    SESSION_CACHE_REPOSITORY,
    APP_LOGGER_SERVICE,
  ]),
  createProvider<UserSessionCacheRepository>(
    SESSION_CACHE_REPOSITORY,
    UserSessionCacheRepository,
    [CACHE_MANAGER],
  ),
  createProvider<SessionCacheService>(
    SESSION_CACHE_SERVICE,
    SessionCacheService,
    [SESSION_CACHE_REPOSITORY, APP_LOGGER_SERVICE],
  ),
  createProvider<SessionTokensService>(
    AUTH_TOKEN_SERVICE,
    SessionTokensService,
    [JWT_TOKEN_SERVICE, CONFIG_PROVIDER, HASH_GENERATOR],
  ),
]
