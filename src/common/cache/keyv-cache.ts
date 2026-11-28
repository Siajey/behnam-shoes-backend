import Keyv from 'keyv'

import { ILogger } from '@common/logger'

import { ICache } from './cache.interface'

const OPERATION_TIMEOUT_MS = 500
const ERROR_LOG_INTERVAL_MS = 60_000

export class KeyvCache implements ICache {
    private readonly inFlight = new Map<string, Promise<unknown>>()
    private lastErrorLoggedAt = 0

    constructor(
        private readonly keyv: Keyv,
        private readonly logger: ILogger,
    ) {}

    async get<T>(key: string): Promise<T | undefined> {
        try {
            return await this.guard(this.keyv.get<T>(key))
        } catch (error) {
            this.report('get', error)
            return undefined
        }
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        try {
            await this.guard(this.keyv.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined))
        } catch (error) {
            this.report('set', error)
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.guard(this.keyv.delete(key))
        } catch (error) {
            this.report('delete', error)
        }
    }

    async remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
        const cached = await this.get<T>(key)
        if (cached !== undefined) return cached

        const running = this.inFlight.get(key) as Promise<T> | undefined
        if (running) return running

        const load = (async () => {
            const value = await loader()
            if (value !== undefined) await this.set(key, value, ttlSeconds)
            return value
        })().finally(() => this.inFlight.delete(key))

        this.inFlight.set(key, load)
        return load
    }

    private guard<T>(operation: Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('cache operation timed out')), OPERATION_TIMEOUT_MS)
            operation.then(
                (value) => {
                    clearTimeout(timer)
                    resolve(value)
                },
                (error) => {
                    clearTimeout(timer)
                    reject(error)
                },
            )
        })
    }

    private report(operation: string, error: unknown): void {
        const now = Date.now()
        if (now - this.lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) return
        this.lastErrorLoggedAt = now

        void this.logger.warn('The cache is not responding, requests are served from the database', {
            module: 'KeyvCache',
            operation,
            event: 'cache.error',
            err: error,
        })
    }
}