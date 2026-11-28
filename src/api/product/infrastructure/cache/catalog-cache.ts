import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'

import { ICache } from '@common/cache'
import { CACHE_SERVICE } from '@common/di'

const VERSION_KEY = 'catalog:version'

export const CATALOG_CACHE_TTL = {
    filters: 300,
    categoryTree: 600,
} as const

@Injectable()
export class CatalogCache {
    constructor(@Inject(CACHE_SERVICE) private readonly cache: ICache) {}

    async remember<T>(
        ttlSeconds: number,
        parts: readonly (string | number | boolean | undefined)[],
        loader: () => Promise<T>,
    ): Promise<T> {
        const version = (await this.cache.get<string>(VERSION_KEY)) ?? '0'
        const key = `catalog:${version}:${parts.map((p) => String(p ?? '')).join(':')}`
        return this.cache.remember(key, ttlSeconds, loader)
    }

    async invalidate(): Promise<void> {
        await this.cache.set(VERSION_KEY, randomUUID())
    }
}