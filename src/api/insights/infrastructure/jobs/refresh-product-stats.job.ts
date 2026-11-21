import {Inject, Injectable} from '@nestjs/common'
import {Cron, CronExpression} from '@nestjs/schedule'

import {REFRESH_PRODUCT_STATS} from '@common/di'

import {IRefreshProductStats} from '../../application'

@Injectable()
export class RefreshProductStatsJob {
    constructor(@Inject(REFRESH_PRODUCT_STATS) private readonly refresh: IRefreshProductStats) {
    }

    @Cron(CronExpression.EVERY_HOUR)
    async run(): Promise<void> {
        try {
            await this.refresh.execute()
        } catch {
        }
    }
}
