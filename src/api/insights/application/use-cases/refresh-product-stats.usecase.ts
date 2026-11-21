import {PRODUCT_STATS_WINDOW_DAYS} from '@api/product/application'
import {ILogger} from '@common/logger'

import {RefreshInProgressError} from '../../domain'
import {IRefreshProductStats, RefreshProductStatsResult} from '../interfaces'
import {IProductFavoritesSource, IProductSalesSource, IProductStatsSink, ProductStatsItem} from '../ports'

const DAY_MS = 24 * 60 * 60 * 1000

export default class RefreshProductStatsUseCase implements IRefreshProductStats {
    private running = false

    constructor(
        private readonly sales: IProductSalesSource,
        private readonly favorites: IProductFavoritesSource,
        private readonly sink: IProductStatsSink,
        private readonly logger: ILogger) {
    }

    async execute(): Promise<RefreshProductStatsResult> {
        if (this.running) throw new RefreshInProgressError()
        this.running = true
        const startedAt = Date.now()
        try {
            const since = new Date(startedAt - PRODUCT_STATS_WINDOW_DAYS * DAY_MS)
            const [sold, favored] = await Promise.all([this.sales.unitsSoldSince(since), this.favorites.favoritesAddedSince(since)])
            const merged = new Map<string, ProductStatsItem>()
            for (const row of sold) merged.set(row.productId, {
                productId: row.productId, unitsSold: row.unitsSold, favoritesAdded: 0
            })
            for (const row of favored) {
                const item = merged.get(row.productId)
                if (item) item.favoritesAdded = row.favoritesAdded
                else merged.set(row.productId, {
                    productId: row.productId,
                    unitsSold: 0,
                    favoritesAdded: row.favoritesAdded
                })
            }
            const outcome = await this.sink.replace([...merged.values()])
            const result = {
                windowDays: PRODUCT_STATS_WINDOW_DAYS,
                products: outcome.total,
                bestSellers: outcome.bestSellers,
                popular: outcome.popular,
                durationMs: Date.now() - startedAt
            }
            void this.logger.info('Product stats refreshed from sales and favorites', {
                module: 'RefreshProductStatsUseCase',
                operation: 'execute',
                event: 'insights.product-stats.refresh',
                durationMs: result.durationMs,
                data: {...result}
            })
            return result
        } catch (error) {
            void this.logger.error('Product stats refresh failed', {
                module: 'RefreshProductStatsUseCase',
                operation: 'execute',
                event: 'insights.product-stats.refresh',
                durationMs: Date.now() - startedAt,
                err: error
            })
            throw error
        } finally {
            this.running = false
        }
    }
}
