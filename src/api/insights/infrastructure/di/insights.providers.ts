import {
    createProvider,
    INSIGHTS_FAVORITES_SOURCE,
    INSIGHTS_SALES_SOURCE,
    INSIGHTS_STATS_SINK,
    REFRESH_PRODUCT_STATS
} from '@common/di'

import {RefreshProductStatsUseCase} from '../../application'

export const InsightsUseCaseProviders = [createProvider<RefreshProductStatsUseCase>(REFRESH_PRODUCT_STATS, RefreshProductStatsUseCase, [INSIGHTS_SALES_SOURCE, INSIGHTS_FAVORITES_SOURCE, INSIGHTS_STATS_SINK])]
