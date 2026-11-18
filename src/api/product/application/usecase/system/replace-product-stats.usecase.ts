import { IProductStatsRepository, rankProductStats } from '@api/product/domain'
import { ILogger } from '@common/logger'

import {
    IReplaceProductStats, ReplaceProductStatsCommand, ReplaceProductStatsResult,
} from '../../interfaces'

export default class ReplaceProductStatsUseCase implements IReplaceProductStats {
    constructor(
        private readonly stats: IProductStatsRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: ReplaceProductStatsCommand): Promise<ReplaceProductStatsResult> {
        const rows = rankProductStats(command.items)
        await this.stats.replaceAll(rows)

        const result = {
            total: rows.length,
            bestSellers: rows.filter((r) => r.isBestSeller).length,
            popular: rows.filter((r) => r.isPopular).length,
        }

        void this.logger.info('Product stats refreshed', {
            module: 'ReplaceProductStatsUseCase',
            operation: 'execute',
            event: 'product.stats.refresh',
            data: result,
        })
        return result
    }
}