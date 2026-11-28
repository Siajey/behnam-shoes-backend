import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'

import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
    jest,
} from '@jest/globals'

import { randomUUID } from 'node:crypto'

import { ILogger } from '@common/logger'
import { KeyvCache } from '@common/cache'
import { CatalogCache, CATALOG_CACHE_TTL } from '@api/product/infrastructure'

describe('CatalogCache (Redis integration)', () => {
    let keyv: Keyv
    let verificationKeyv: Keyv

    let catalogCache: CatalogCache
    let anotherInstanceCatalogCache: CatalogCache

    const namespace = `test:catalog-cache:${randomUUID()}`

    const logger = {
        warn: jest.fn(),
    } as unknown as ILogger

    beforeAll(() => {
        const redisUrl = process.env.REDIS_URL

        if (!redisUrl) {
            throw new Error('REDIS_URL must be configured')
        }

        // First application instance.
        keyv = new Keyv({
            store: new KeyvRedis(redisUrl),
            namespace,
        })

        // Independent connection simulating another application instance.
        verificationKeyv = new Keyv({
            store: new KeyvRedis(redisUrl),
            namespace,
        })

        const cache = new KeyvCache(keyv, logger)
        const anotherInstanceCache = new KeyvCache(verificationKeyv, logger)

        catalogCache = new CatalogCache(cache)
        anotherInstanceCatalogCache = new CatalogCache(anotherInstanceCache)
    })

    afterAll(async () => {
        await Promise.all([
            keyv.disconnect(),
            verificationKeyv.disconnect(),
        ])
    })

    describe('category tree', () => {
        it('stores category tree data in Redis', async () => {
            const parts = ['categories', 'tree', randomUUID()]

            const version =
                (await verificationKeyv.get<string>('catalog:version')) ?? '0'

            const redisKey = `catalog:${version}:${parts.join(':')}`

            const categories = [
                {
                    id: 'category-1',
                    name: 'Shoes',
                    children: [],
                },
            ]

            const loader = jest.fn<() => Promise<typeof categories>>()
                .mockResolvedValue(categories)

            const result = await catalogCache.remember(
                CATALOG_CACHE_TTL.categoryTree,
                parts,
                loader,
            )

            expect(result).toEqual(categories)
            expect(loader).toHaveBeenCalledTimes(1)

            // Verify the actual Redis entry using another connection.
            await expect(
                verificationKeyv.get(redisKey),
            ).resolves.toEqual(categories)
        })

        it('returns cached category tree data across application instances', async () => {
            const parts = ['categories', 'tree', randomUUID()]

            const categories = [
                {
                    id: 'category-1',
                    name: 'Shoes',
                    children: [],
                },
            ]

            const loader = jest.fn<() => Promise<typeof categories>>()
                .mockResolvedValue(categories)

            // First instance populates Redis.
            await catalogCache.remember(
                CATALOG_CACHE_TTL.categoryTree,
                parts,
                loader,
            )

            // Second instance must retrieve the same data from Redis.
            const anotherLoader = jest.fn<() => Promise<typeof categories>>()
                .mockResolvedValue([])

            const result = await anotherInstanceCatalogCache.remember(
                CATALOG_CACHE_TTL.categoryTree,
                parts,
                anotherLoader,
            )

            expect(result).toEqual(categories)
            expect(anotherLoader).not.toHaveBeenCalled()
        })
    })

    describe('catalog filters', () => {
        it('stores catalog filters in Redis', async () => {
            const parts = ['filters', randomUUID()]

            const version =
                (await verificationKeyv.get<string>('catalog:version')) ?? '0'

            const redisKey = `catalog:${version}:${parts.join(':')}`

            const filters = {
                brands: ['brand-1', 'brand-2'],
                categories: ['category-1', 'category-2'],
            }

            const loader = jest.fn<() => Promise<typeof filters>>()
                .mockResolvedValue(filters)

            const result = await catalogCache.remember(
                CATALOG_CACHE_TTL.filters,
                parts,
                loader,
            )

            expect(result).toEqual(filters)

            await expect(
                verificationKeyv.get(redisKey),
            ).resolves.toEqual(filters)
        })

        it('returns cached filters without executing the loader again', async () => {
            const parts = ['filters', randomUUID()]

            const filters = {
                brands: ['brand-1'],
                categories: ['category-1'],
            }

            const firstLoader = jest.fn<() => Promise<typeof filters>>()
                .mockResolvedValue(filters)

            await catalogCache.remember(
                CATALOG_CACHE_TTL.filters,
                parts,
                firstLoader,
            )

            const secondLoader = jest.fn<() => Promise<typeof filters>>()
                .mockResolvedValue({
                    brands: [],
                    categories: [],
                })

            const result = await anotherInstanceCatalogCache.remember(
                CATALOG_CACHE_TTL.filters,
                parts,
                secondLoader,
            )

            expect(result).toEqual(filters)
            expect(secondLoader).not.toHaveBeenCalled()
        })
    })

    describe('invalidation', () => {
        it('invalidates previous catalog entries by changing the version', async () => {
            const parts = ['categories', 'tree', randomUUID()]

            const oldCategories = [{ id: 'category-1', name: 'Old' }]
            const newCategories = [{ id: 'category-1', name: 'Updated' }]

            const firstLoader = jest.fn<() => Promise<typeof oldCategories>>()
                .mockResolvedValue(oldCategories)

            // Populate the old version.
            await catalogCache.remember(
                CATALOG_CACHE_TTL.categoryTree,
                parts,
                firstLoader,
            )

            const oldVersion =
                (await verificationKeyv.get<string>('catalog:version')) ?? '0'

            // Invalidate all catalog cache entries.
            await catalogCache.invalidate()

            const newVersion =
                await verificationKeyv.get<string>('catalog:version')

            expect(newVersion).toBeDefined()
            expect(newVersion).not.toBe(oldVersion)

            // The next request must use the new version.
            const secondLoader = jest.fn<() => Promise<typeof newCategories>>()
                .mockResolvedValue(newCategories)

            const result = await anotherInstanceCatalogCache.remember(
                CATALOG_CACHE_TTL.categoryTree,
                parts,
                secondLoader,
            )

            expect(result).toEqual(newCategories)
            expect(secondLoader).toHaveBeenCalledTimes(1)
        })
    })

    describe('expiration', () => {
        it('expires catalog entries after their TTL', async () => {
            const parts = ['filters', randomUUID()]

            const version =
                (await verificationKeyv.get<string>('catalog:version')) ?? '0'

            const redisKey = `catalog:${version}:${parts.join(':')}`

            const filters = {
                brands: ['brand-1'],
                categories: ['category-1'],
            }

            await catalogCache.remember(
                1,
                parts,
                async () => filters,
            )

            await expect(
                verificationKeyv.get(redisKey),
            ).resolves.toEqual(filters)

            await new Promise((resolve) => setTimeout(resolve, 1200))

            await expect(
                verificationKeyv.get(redisKey),
            ).resolves.toBeUndefined()
        })
    })
})