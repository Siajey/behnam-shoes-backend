import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals'
import { randomUUID } from 'node:crypto'

import { ICache, KeyvCache } from '@common/cache'
import { ILogger } from '@common/logger'

import { User, UserRole, UserStatus } from '@api/users/domain'
import { SessionCacheService } from '@api/session/application'
import { UserSessionCacheRepository } from '@api/session/infrastructure'

describe('SessionCacheService (integration)', () => {
    let keyv: Keyv
    let cache: ICache
    let sessionCache: SessionCacheService

    const logger = {
        warn: jest.fn(),
    } as unknown as ILogger

    const createUser = (): User => ({
        id: randomUUID(),
        updatedAt: new Date('2026-11-28T10:00:00.000Z'),
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
    }) as User

    beforeAll(async () => {
        const redisUrl = process.env.REDIS_URL

        if (!redisUrl) {
            throw new Error('REDIS_URL must be configured for cache integration tests')
        }

        keyv = new Keyv({
            store: new KeyvRedis(redisUrl),
            namespace: 'test:session-cache',
        })

        cache = new KeyvCache(keyv, logger)

        const repository = new UserSessionCacheRepository(cache)

        sessionCache = new SessionCacheService(repository, logger)
    })

    afterAll(async () => {
        await keyv.disconnect()
    })

    describe('getUserSession', () => {
        it('returns undefined when the session does not exist', async () => {
            const user = createUser()

            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })

        it('returns the cached session', async () => {
            const user = createUser()

            await sessionCache.setUserSession(user.id, user)

            expect(await sessionCache.getUserSession(user.id)).toMatchObject({
                updatedAt: expect.any(String),
                status: user.status,
                role: user.role,
            })
        })
    })

    describe('setUserSession', () => {
        it('stores only the required session properties', async () => {
            const user = createUser()

            await sessionCache.setUserSession(user.id, user)

            const result = await sessionCache.getUserSession(user.id)

            expect(result).toEqual({
                updatedAt: user.updatedAt?.toISOString(),
                status: user.status,
                role: user.role,
            })
        })

        it.each([
            UserRole.USER,
            UserRole.ADMIN,
        ])('stores the %s role correctly', async (role) => {
            const user = {
                ...createUser(),
                role,
            } as User

            await sessionCache.setUserSession(user.id, user)

            expect(await sessionCache.getUserSession(user.id)).toMatchObject({
                role,
                status: UserStatus.ACTIVE,
            })
        })
    })

    describe('invalidateUserSession', () => {
        it('deletes the cached session', async () => {
            const user = createUser()

            await sessionCache.setUserSession(user.id, user)

            expect(await sessionCache.getUserSession(user.id)).toBeDefined()

            await sessionCache.invalidateUserSession(user.id)

            expect(await sessionCache.getUserSession(user.id)).toBeUndefined()
        })

        it('does not invalidate another user session', async () => {
            const first = createUser()
            const second = createUser()

            await sessionCache.setUserSession(first.id, first)
            await sessionCache.setUserSession(second.id, second)

            await sessionCache.invalidateUserSession(first.id)

            expect(await sessionCache.getUserSession(first.id)).toBeUndefined()

            expect(await sessionCache.getUserSession(second.id)).toMatchObject({
                role: second.role,
                status: second.status,
            })
        })

        it('can invalidate an already missing session', async () => {
            const user = createUser()

            await expect(
                sessionCache.invalidateUserSession(user.id),
            ).resolves.toBeUndefined()
        })
    })
})