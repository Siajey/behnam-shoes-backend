import { ISessionCacheRepository } from '@api/session/domain'
import { User } from '@api/users/domain'
import { ILogger } from '@common/logger'

export class SessionCacheService {
  constructor(
    private readonly cache: ISessionCacheRepository,
    private readonly logger: ILogger,
  ) {}

  async getUserSession(userId: string) {
    try {
      return await this.cache.getUserSession(userId)
    } catch (error) {
      this.logger.warn('Failed to get user session', {
        module: 'SessionCacheService',
        operation: 'getUserSession',
        userId,
        err: error,
      })
    }
  }

  async setUserSession(userId: string, data: User): Promise<void> {
    try {
      await this.cache.setUserSession(userId, data)
    } catch (error) {
      this.logger.warn('Failed to cache user session', {
        module: 'SessionCacheService',
        operation: 'setUserSession',
        userId,
        err: error,
      })
    }
  }

  async invalidateUserSession(userId: string): Promise<void> {
    try {
      return this.cache.invalidateUserSession(userId)
    } catch (error) {
      this.logger.warn('Failed to invalidate user session', {
        module: 'SessionCacheService',
        operation: 'invalidateUserSession',
        userId,
        err: error,
      })
    }
  }
}
