import { Inject, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { ISyncShipmentStatuses } from '@api/order/application'
import { SYNC_SHIPMENT_STATUSES } from '@common/di'

@Injectable()
export class SyncShipmentStatusesJob {
  constructor(@Inject(SYNC_SHIPMENT_STATUSES) private readonly sync: ISyncShipmentStatuses) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    try {
      await this.sync.execute()
    } catch {
      // logged where it happens
    }
  }
}
