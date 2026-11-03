import { ILogin, LoginBody, LoginStrategy } from '@api/auth/application'
import { UserResponse } from '@api/users/domain'
import { SessionCacheService } from '@session/application'

export class LoginUsecase implements ILogin {
  constructor(
    private readonly localLoginStrategy: LoginStrategy,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async execute(loginBody: LoginBody): Promise<UserResponse> {
    const user = await this.localLoginStrategy.handleLogin(loginBody)
    await this.sessionCache.setUserSession(user.id, user)
    return {
      id: user.id,
      createdAt: user.createdAt,
      role: user.role,
      email: user.email,
      updatedAt: user.updatedAt,
      status: user.status,
      username: user.username,
    }
  }
}
