export interface ICache {
    get<T>(key: string): Promise<T | undefined>
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
    delete(key: string): Promise<void>
    remember<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>
}