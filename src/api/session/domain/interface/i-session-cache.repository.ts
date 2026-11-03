import { User } from '@api/users/domain'

export interface ISessionCacheRepository {
  getUserSession(userId: string): Promise<User>

  setUserSession(userId: string, data: User): Promise<void>

  invalidateUserSession(userId: string): Promise<void>
}
