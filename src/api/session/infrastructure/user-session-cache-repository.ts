import {ISessionCacheRepository, UserSessionState} from '@api/session/domain'

import { ICache } from '@common/cache'

const USER_SESSION_TTL_SECONDS = 60 * 60

export class UserSessionCacheRepository implements ISessionCacheRepository {
    constructor(private readonly cache: ICache) {}

    async getUserSession(userId: string): Promise<UserSessionState | undefined> {
        return this.cache.get<UserSessionState>(this.getKey(userId))
    }

    async setUserSession(userId: string, data: UserSessionState): Promise<void> {
        await this.cache.set<UserSessionState>(
            this.getKey(userId),
            {
                updatedAt: data.updatedAt,
                status: data.status,
                role: data.role,
            },
            USER_SESSION_TTL_SECONDS,
        )
    }

    async invalidateUserSession(userId: string): Promise<void> {
        await this.cache.delete(this.getKey(userId))
    }

    private getKey(userId: string): string {
        return `user:sessions:${userId}`
    }
}
