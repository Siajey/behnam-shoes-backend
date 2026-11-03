import { SessionCacheService } from '@session/application'
import { ILogout } from '@api/auth/application'
import { IUserRepository, UserStatus } from '@api/users/domain'
import { ILogger } from '@common/logger'

export class LogoutUseCase implements ILogout {
  constructor(
    private readonly sessionCache: SessionCacheService,
    private readonly userRepository: IUserRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(userId: string) {
    await this.userRepository.update(userId, {
      status: UserStatus.INACTIVE,
    })
    await this.sessionCache.invalidateUserSession(userId)
    this.logger.info('User is logged out successfully.', {
      module: 'LogoutUseCase',
      event: 'auth.logout',
      operation: 'logout',
      userId: userId,
    })
    return
  }
}
