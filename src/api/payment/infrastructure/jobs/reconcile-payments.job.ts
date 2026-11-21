import {Inject, Injectable} from '@nestjs/common'
import {Cron, CronExpression} from '@nestjs/schedule'

import {RECONCILE_PAYMENTS} from '@common/di'
import {IReconcilePayments} from '@api/payment/application'

@Injectable()
export class ReconcilePaymentsJob {
    constructor(@Inject(RECONCILE_PAYMENTS) private readonly reconcile: IReconcilePayments) {
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async run(): Promise<void> {
        try {
            await this.reconcile.execute()
        } catch { /* use case logs; retry next schedule */
        }
    }
}
