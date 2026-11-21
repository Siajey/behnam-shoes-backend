import { Module } from '@nestjs/common'

import { AuthModule } from '@api/auth'
import { FavoritesModule } from '@api/favorites/favorite.module'
import { INSIGHTS_FAVORITES_SOURCE, INSIGHTS_SALES_SOURCE, INSIGHTS_STATS_SINK } from '@common/di'
import { OrderModule } from '@api/order/order.module'
import { ProductModule } from '@api/product/product.module'
import { SessionModule } from '@api/session'

import { FavoritesSource, InsightsUseCaseProviders, OrderSalesSource, ProductStatsSink, RefreshProductStatsJob } from './infrastructure'
import { AdminInsightsController } from './presentation'

@Module({
    imports: [ProductModule, OrderModule, FavoritesModule, SessionModule, AuthModule],
    controllers: [AdminInsightsController],
    providers: [
        { provide: INSIGHTS_SALES_SOURCE, useClass: OrderSalesSource },
        { provide: INSIGHTS_FAVORITES_SOURCE, useClass: FavoritesSource },
        { provide: INSIGHTS_STATS_SINK, useClass: ProductStatsSink },
        ...InsightsUseCaseProviders, RefreshProductStatsJob,
    ],
})
export class InsightsModule {}
