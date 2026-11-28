import {getVerificationSecrets, ITokenService, SecretType,} from '@common/security'
import {ConfigProvider} from '@common/configuration'
import {ForbiddenError, UnAuthorizedError} from '@common/errors'
import {IUserRepository, UserStatus} from '@api/users/domain'
import {ISessionCacheRepository} from '@api/session/domain'
import {ILogger} from '@common/logger'

export class SessionValidator {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: ITokenService,
        private readonly configProvider: ConfigProvider,
        private readonly userCache: ISessionCacheRepository,
        private readonly logger: ILogger,
    ) {
    }

    async execute(token: string) {
        if (!token) {
            this.logger.warn('Session validation failed: access token is missing', {
                module: 'SessionValidator',
                event: 'Session.Validate',
                operation: 'session',
            })
            throw new UnAuthorizedError({
                code: 'AccessTokenMissing',
                message: 'errors.sessions.accessTokenMissing',
            })
        }
        let payload: { identifier: any; iat: number }
        const secrets = getVerificationSecrets(
            this.configProvider,
            SecretType.ACCESS_TOKEN,
        )
        try {
            payload = this.tokenService.verifyAny(token, secrets)
        } catch (error) {
            this.logger.warn('The session token is invalid or has expired', {
                module: 'SessionValidator',
                event: 'Session.validate',
                operation: 'session',
                err: error,
            })
            throw new UnAuthorizedError({
                code: 'InvalidAccessToken',
                message: 'errors.sessions.invalidAccessToken',
            })
        }

        const userId = payload.identifier

        let user = await this.userCache.getUserSession(userId)

        if (!user) {
            const sessionState = await this.userRepository.findSessionState(userId)

            if (!sessionState) {
                this.logger.warn('User not found', {
                    module: 'SessionValidator',
                    event: 'Session.validate',
                    operation: 'session',
                    userId,
                })

                throw new UnAuthorizedError({
                    code: 'UserNotFound',
                    message: 'errors.validation.user.notFound',
                })
            }

            await this.userCache.setUserSession(userId, {
                ...sessionState,
                updatedAt: sessionState.updatedAt.toISOString()
            })

            user = {
                updatedAt: sessionState.updatedAt.toISOString(),
                status: sessionState.status,
                role: sessionState.role,
            }
        }

        if (user.status !== UserStatus.ACTIVE) {
            this.logger.warn('User is not active', {
                module: 'SessionValidator',
                event: 'Session.validate',
                operation: 'session',
                userId,
            })

            throw new ForbiddenError({
                code: 'FORBIDDEN',
                message: 'errors.sessions.userInactive',
            })
        }

        return {id: userId, role: user.role}

    }
}
