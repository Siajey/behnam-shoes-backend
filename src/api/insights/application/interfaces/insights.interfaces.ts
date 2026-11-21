export interface RefreshProductStatsResult {
    windowDays: number;
    products: number;
    bestSellers: number;
    popular: number;
    durationMs: number
}

export interface IRefreshProductStats {
    execute(): Promise<RefreshProductStatsResult>
}
