import { ICache } from './cache.interface'

export class NoopCache implements ICache {
    async get<T>(): Promise<T | undefined> {
        return undefined
    }
    async set(): Promise<void> {}
    async delete(): Promise<void> {}
    remember<T>(_key: string, _ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
        return loader()
    }
}