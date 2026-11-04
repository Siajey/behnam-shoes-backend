import {ILogin, LoginBody, LoginStrategy} from '@api/auth/application'
import {User} from '@api/users/domain'
import {SessionCacheService} from '@api/session/application'

export class LoginUsecase implements ILogin {
    constructor(
        private readonly otpStrategy: LoginStrategy,
        private readonly sessionCache: SessionCacheService,
    ) {
    }

    async execute(loginBody: LoginBody): Promise<User> {
        const user = await this.otpStrategy.handleLogin(loginBody)
        await this.sessionCache.setUserSession(user.id, user)
        return {
            id: user.id,
            phoneNumber: user.phoneNumber,
            createdAt: user.createdAt,
            role: user.role,
            updatedAt: user.updatedAt,
            status: user.status,
        }
    }
}
