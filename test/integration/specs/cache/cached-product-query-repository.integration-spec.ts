import Keyv from 'keyv'
import KeyvRedis from '@keyv/redis'

import { randomUUID } from 'node:crypto'

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from '@jest/globals'

import { ILogger } from '@common/logger'
import { KeyvCache } from '@common/cache'

import {
    CatalogFilters,
    IProductQueryRepository,
    ProductStatus,
} from '@api/product/domain'

import {CachedProductQueryRepository, CatalogCache} from '@api/product/infrastructure'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const NAMESPACE = `catalog-cache-test:${randomUUID()}`

const VERSION_KEY = 'catalog:version'

const filters: CatalogFilters = {
    categories: [
        {
            id: 'category-1',
            name: 'Running Shoes',
            slug: 'running-shoes',
            count: 12,
        },
    ],
    brands: [
        {
            id: 'brand-1',
            name: 'Nike',
            slug: 'nike',
            count: 8,
        },
    ],
    priceRange: {
        min: 500_000,
        max: 5_000_000,
    },
    attributes: [
        {
            name: 'color',
            values: [
                { value: 'black', count: 5 },
                { value: 'white', count: 3 },
            ],
        },
    ],
    specs: [],
}

const updatedFilters: CatalogFilters = {
    ...filters,
    categories: [
        {
            id: 'category-1',
            name: 'Running Shoes',
            slug: 'running-shoes',
            count: 20,
        },
    ],
}

const createRepositoryMock = (): jest.Mocked<IProductQueryRepository> => ({
    findAll: jest.fn<IProductQueryRepository['findAll']>(),
    search: jest.fn<IProductQueryRepository['search']>(),
    findDetailsById: jest.fn<IProductQueryRepository['findDetailsById']>(),
    findDetailsByIds: jest.fn<IProductQueryRepository['findDetailsByIds']>(),
    findPublishedIds: jest.fn<IProductQueryRepository['findPublishedIds']>(),
    findDetailsBySlug: jest.fn<IProductQueryRepository['findDetailsBySlug']>(),
    getFilters: jest.fn<IProductQueryRepository['getFilters']>(),
})

const createCriteria = (
    categoryId: string,
    statuses: ProductStatus[] = ['published'] as ProductStatus[],
) => ({
    categoryId,
    statuses,
})

describe('CachedProductQueryRepository (Redis integration)', () => {
    let keyv: Keyv
    let verificationKeyv: Keyv

    let cache: KeyvCache
    let verificationCache: KeyvCache

    let catalogCache: CatalogCache
    let verificationCatalogCache: CatalogCache

    let innerRepository: jest.Mocked<IProductQueryRepository>
    let verificationRepository: jest.Mocked<IProductQueryRepository>

    let repository: CachedProductQueryRepository
    let verificationRepositoryWithCache: CachedProductQueryRepository

    const logger = {
        warn: jest.fn(),
    } as unknown as ILogger

    beforeAll(async () => {
        // First independent Redis connection.
        keyv = new Keyv({
            store: new KeyvRedis(REDIS_URL),
            namespace: NAMESPACE,
        })

        // Second independent Redis connection.
        verificationKeyv = new Keyv({
            store: new KeyvRedis(REDIS_URL),
            namespace: NAMESPACE,
        })

        // Verify that Redis is reachable through both connections.
        await Promise.all([
            keyv.get('__connection_test__'),
            verificationKeyv.get('__connection_test__'),
        ])

        cache = new KeyvCache(keyv, logger)
        verificationCache = new KeyvCache(verificationKeyv, logger)

        catalogCache = new CatalogCache(cache)
        verificationCatalogCache = new CatalogCache(verificationCache)

        innerRepository = createRepositoryMock()
        verificationRepository = createRepositoryMock()

        repository = new CachedProductQueryRepository(
            innerRepository,
            catalogCache,
        )

        verificationRepositoryWithCache = new CachedProductQueryRepository(
            verificationRepository,
            verificationCatalogCache,
        )
    })

    afterAll(async () => {
        await Promise.all([
            keyv.disconnect(),
            verificationKeyv.disconnect(),
        ])
    })

    beforeEach(() => {
        innerRepository.getFilters.mockReset()
        verificationRepository.getFilters.mockReset()
    })

    describe('getFilters', () => {
        it('should store catalog filters in Redis', async () => {
            const criteria = createCriteria('category-storage-test')

            innerRepository.getFilters.mockResolvedValue(filters)

            const result = await repository.getFilters(criteria)

            expect(result).toEqual(filters)
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(1)

            // Read the current catalog version directly from the second
            // Redis connection.
            const version = (await verificationKeyv.get<string>(VERSION_KEY)) ?? '0'

            // Reconstruct the exact key generated by CatalogCache.
            const cacheKey = `catalog:${version}:filters:published:category-storage-test`

            // Verify that the complete filters object is stored in Redis.
            const cachedFilters = await verificationKeyv.get<CatalogFilters>(cacheKey)

            expect(cachedFilters).toEqual(filters)
        })

        it('should return cached filters from Redis across different application instances', async () => {
            const criteria = createCriteria('category-cross-instance-test')

            innerRepository.getFilters.mockResolvedValue(filters)


            const firstResult = await repository.getFilters(criteria)

            expect(firstResult).toEqual(filters)
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(1)

            // Second application instance has its own Keyv connection,
            // KeyvCache and CatalogCache.
            verificationRepository.getFilters.mockResolvedValue(updatedFilters)

            const secondResult = await verificationRepositoryWithCache.getFilters(criteria)

            // It should return the existing Redis value, not the
            // value returned by the second repository.
            expect(secondResult).toEqual(filters)

            expect(verificationRepository.getFilters).not.toHaveBeenCalled()
        })

        it('should use different cache keys for different categories', async () => {
            const firstCriteria = createCriteria('category-a')
            const secondCriteria = createCriteria('category-b')

            innerRepository.getFilters
                .mockResolvedValueOnce(filters)
                .mockResolvedValueOnce(updatedFilters)

            const firstResult = await repository.getFilters(firstCriteria)
            const secondResult = await repository.getFilters(secondCriteria)

            expect(firstResult).toEqual(filters)
            expect(secondResult).toEqual(updatedFilters)

            expect(innerRepository.getFilters).toHaveBeenCalledTimes(2)
        })

        it('should generate the same cache key regardless of status order', async () => {
            const firstCriteria = createCriteria(
                'category-status-order-test',
                ['published', 'draft'] as ProductStatus[],
            )

            const secondCriteria = createCriteria(
                'category-status-order-test',
                ['draft', 'published'] as ProductStatus[],
            )

            innerRepository.getFilters.mockResolvedValue(filters)

            const firstResult = await repository.getFilters(firstCriteria)
            const secondResult = await repository.getFilters(secondCriteria)

            expect(firstResult).toEqual(filters)
            expect(secondResult).toEqual(filters)

            // Both criteria should resolve to the same cache key
            // because CatalogCache sorts the statuses.
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(1)
        })

        it('should reload filters after catalog cache invalidation', async () => {
            const criteria = createCriteria('category-invalidation-test')

            innerRepository.getFilters
                .mockResolvedValueOnce(filters)
                .mockResolvedValueOnce(updatedFilters)

            // Initial request populates the cache.
            const firstResult = await repository.getFilters(criteria)

            expect(firstResult).toEqual(filters)
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(1)

            // Change the catalog version.
            await catalogCache.invalidate()

            // The next request must use a different cache key.
            const secondResult = await repository.getFilters(criteria)

            expect(secondResult).toEqual(updatedFilters)
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(2)
        })

        it('should not cache failed repository queries', async () => {
            const criteria = createCriteria('category-loader-error-test')

            innerRepository.getFilters
                .mockRejectedValueOnce(new Error('Database unavailable'))
                .mockResolvedValueOnce(filters)

            // First request fails.
            await expect(repository.getFilters(criteria)).rejects.toThrow(
                'Database unavailable',
            )

            // Second request should retry the repository instead of
            // returning a cached failure.
            const result = await repository.getFilters(criteria)

            expect(result).toEqual(filters)
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(2)
        })

        it('should not cache failed repository queries', async () => {
            const criteria = createCriteria(`category-loader-error-${randomUUID()}`)

            // Ensure this test starts with a fresh catalog version.
            await catalogCache.invalidate()

            innerRepository.getFilters
                .mockRejectedValueOnce(new Error('Database unavailable'))
                .mockResolvedValueOnce(filters)

            // First request should execute the loader and fail.
            await expect(repository.getFilters(criteria)).rejects.toThrow(
                'Database unavailable',
            )

            expect(innerRepository.getFilters).toHaveBeenCalledTimes(1)

            // Second request should execute the loader again.
            const result = await repository.getFilters(criteria)

            expect(result).toEqual(filters)
            expect(innerRepository.getFilters).toHaveBeenCalledTimes(2)

            // Successful result should now be available in Redis.
            const version = (await verificationKeyv.get<string>(VERSION_KEY)) ?? '0'

            const cacheKey = `catalog:${version}:filters:published:${criteria.categoryId}`

            const cachedFilters = await verificationKeyv.get<CatalogFilters>(cacheKey)

            expect(cachedFilters).toEqual(filters)
        })
    })
})