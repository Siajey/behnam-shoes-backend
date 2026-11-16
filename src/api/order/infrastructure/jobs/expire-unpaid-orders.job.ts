import { Inject, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { IExpireUnpaidOrders } from '@api/order/application'
import { EXPIRE_UNPAID_ORDERS } from '@common/di'

@Injectable()
export class ExpireUnpaidOrdersJob {
  constructor(@Inject(EXPIRE_UNPAID_ORDERS) private readonly expireUnpaidOrders: IExpireUnpaidOrders) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async run(): Promise<void> {
    await this.expireUnpaidOrders.execute()
  }
}
