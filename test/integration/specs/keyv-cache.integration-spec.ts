import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals'
import { randomUUID } from 'node:crypto'

import { ILogger } from '@common/logger'
import { KeyvCache } from '@common/cache'

describe('KeyvCache (integration)', () => {
    let keyv: Keyv
    let cache: KeyvCache

    const logger = {
        warn: jest.fn(),
    } as unknown as ILogger

    beforeAll(() => {
        const redisUrl = process.env.REDIS_URL

        if (!redisUrl) {
            throw new Error('REDIS_URL must be configured')
        }

        keyv = new Keyv({
            store: new KeyvRedis(redisUrl),
            namespace: 'test:keyv-cache',
        })

        cache = new KeyvCache(keyv, logger)
    })

    afterAll(async () => {
        await keyv.disconnect()
    })

    it('stores and retrieves a value', async () => {
        const key = randomUUID()

        await cache.set(key, { value: 'hello' })

        expect(await cache.get(key)).toEqual({ value: 'hello' })
    })

    it('deletes a value', async () => {
        const key = randomUUID()

        await cache.set(key, 'hello')
        await cache.delete(key)

        expect(await cache.get(key)).toBeUndefined()
    })

    it('expires values after their TTL', async () => {
        const key = randomUUID()

        await cache.set(key, 'hello', 1)

        expect(await cache.get(key)).toBe('hello')

        await new Promise((resolve) => setTimeout(resolve, 1200))

        expect(await cache.get(key)).toBeUndefined()
    })

    it('executes the loader on a cache miss', async () => {
        const key = randomUUID()
        const loader = jest.fn<() => Promise<string>>().mockResolvedValue('loaded')

        const result = await cache.remember(key, 60, loader)

        expect(result).toBe('loaded')
        expect(loader).toHaveBeenCalledTimes(1)
        expect(await cache.get(key)).toBe('loaded')
    })

    it('does not execute the loader on a cache hit', async () => {
        const key = randomUUID()
        const loader = jest.fn<() => Promise<string>>().mockResolvedValue('loaded')

        await cache.set(key, 'cached')

        const result = await cache.remember(key, 60, loader)

        expect(result).toBe('cached')
        expect(loader).not.toHaveBeenCalled()
    })

    it('deduplicates concurrent loaders for the same key', async () => {
        const key = randomUUID()

        let resolveLoader!: (value: string) => void

        const loader = jest.fn(
            () => new Promise<string>((resolve) => {
                resolveLoader = resolve
            }),
        )

        const first = cache.remember(key, 60, loader)
        const second = cache.remember(key, 60, loader)
        const third = cache.remember(key, 60, loader)

        // Allow all calls to reach the in-flight lookup.
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(loader).toHaveBeenCalledTimes(1)

        resolveLoader('shared-result')

        await expect(Promise.all([first, second, third])).resolves.toEqual([
            'shared-result',
            'shared-result',
            'shared-result',
        ])
    })
})