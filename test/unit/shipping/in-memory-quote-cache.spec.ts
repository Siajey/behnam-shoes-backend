import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {InMemoryQuoteCache} from '@api/shipping/infrastructure'

const quote = {fee: 100, estimatedDays: null}
const cacheWith = (seconds: string | undefined) => new InMemoryQuoteCache({getOptional: () => seconds} as any)

describe('InMemoryQuoteCache', () => {
    beforeEach(() => jest.useFakeTimers({now: new Date('2030-01-01T00:00:00Z')}))
    afterEach(() => jest.useRealTimers())

    it('loads once per key within the TTL and separates keys', async () => {
        const cache = cacheWith('60')
        const loader = jest.fn(async () => quote)

        await cache.getOrLoad('a', loader)
        await cache.getOrLoad('a', loader)
        await cache.getOrLoad('b', loader)

        expect(loader).toHaveBeenCalledTimes(2)
    })

    it('shares one in-flight load between parallel callers', async () => {
        const cache = cacheWith('60')
        const loader = jest.fn(async () => quote)

        const results = await Promise.all([cache.getOrLoad('a', loader), cache.getOrLoad('a', loader), cache.getOrLoad('a', loader)])

        expect(loader).toHaveBeenCalledTimes(1)
        expect(results.every((r) => r === results[0])).toBe(true)
    })

    it('reloads after the TTL has passed', async () => {
        const cache = cacheWith('60')
        const loader = jest.fn(async () => quote)
        await cache.getOrLoad('a', loader)

        jest.setSystemTime(new Date('2030-01-01T00:00:59Z'))
        await cache.getOrLoad('a', loader)
        expect(loader).toHaveBeenCalledTimes(1)

        jest.setSystemTime(new Date('2030-01-01T00:01:01Z'))
        await cache.getOrLoad('a', loader)
        expect(loader).toHaveBeenCalledTimes(2)
    })

    it('never caches a failure', async () => {
        const cache = cacheWith('60')
        const loader = jest.fn<() => Promise<typeof quote>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue(quote)

        await expect(cache.getOrLoad('a', loader)).rejects.toThrow('down')
        await Promise.resolve() // let the cleanup handler run
        await expect(cache.getOrLoad('a', loader)).resolves.toEqual(quote)

        expect(loader).toHaveBeenCalledTimes(2)
    })

    it.each([['0'], ['-5'], ['abc'], [undefined]])('with a TTL of %p it behaves as configured', async (seconds) => {
        const cache = cacheWith(seconds)
        const loader = jest.fn(async () => quote)

        await cache.getOrLoad('a', loader)
        await cache.getOrLoad('a', loader)

        // 0, negative and invalid values disable caching; a missing value defaults to 600 seconds
        expect(loader).toHaveBeenCalledTimes(seconds === undefined ? 1 : 2)
    })

    it('stays bounded: after 1000 entries the oldest are dropped', async () => {
        const cache = cacheWith('600')
        const loader = jest.fn(async () => quote)
        for (let i = 0; i <= 1000; i++) await cache.getOrLoad(`k${i}`, loader)
        loader.mockClear()

        await cache.getOrLoad('k1000', loader) // newest: still cached
        await cache.getOrLoad('k0', loader) // oldest: evicted

        expect(loader).toHaveBeenCalledTimes(1)
    })
})
