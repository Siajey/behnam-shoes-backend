import { Cache } from 'cache-manager'

import { User } from '@api/users/domain'
import { ISessionCacheRepository } from '@session/domain'

export class UserSessionCacheRepository implements ISessionCacheRepository {
  constructor(private readonly cache: Cache) {}

  async getUserSession(userId: string) {
    return await this.cache.get<User>(`user:sessions:${userId}`)
  }

  async setUserSession(userId: string, data: User) {
    await this.cache.set<User>(
      `user:sessions:${userId}`,
      {
        updatedAt: data.updatedAt,
        status: data.status,
        passwordChangedAt: data.passwordChangedAt,
        role: data.role,
      } as User,
      60 * 60 * 1000,
    )
  }

  async invalidateUserSession(userId: string) {
    // cache manager has no del function so we have to call delete
    await this.cache['delete'](`user:sessions:${userId}`)
  }
}
