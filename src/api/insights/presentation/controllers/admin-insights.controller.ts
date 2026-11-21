import {Controller, Inject, Post} from '@nestjs/common'

import {SuccessResponse} from '@common/api'
import {AdminWriteOnly} from '@common/decorator'

import {REFRESH_PRODUCT_STATS} from '@common/di'

import {IRefreshProductStats} from '../../application'

@Controller('admin/insights')
export class AdminInsightsController {
    constructor(@Inject(REFRESH_PRODUCT_STATS) private readonly refresh: IRefreshProductStats) {
    }

    @Post('product-stats/refresh')
    @AdminWriteOnly()
    async refreshController() {
        const result = await this.refresh.execute()
        return new SuccessResponse({
            messageObj: {message: 'common.insights.productStatsRefreshSuccess'},
            code: 'INSIGHTS_PRODUCT_STATS_REFRESH_SUCCESS',
            path: '/admin/insights/product-stats/refresh',
            data: result
        })
    }
}
