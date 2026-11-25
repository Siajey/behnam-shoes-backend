import { Inject, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'

import { IPollShipments } from '@api/shipping/application'
import { ConfigProvider } from '@common/configuration'
import { CONFIG_PROVIDER, POLL_SHIPMENTS } from '@common/di'

@Injectable()
export class PollShipmentsJob {
  constructor(
    @Inject(POLL_SHIPMENTS) private readonly poll: IPollShipments,
    @Inject(CONFIG_PROVIDER) private readonly config: ConfigProvider,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    if (this.config.getOptional('SHIPPING_TRACKING_ENABLED') !== 'true') return

    try {
      await this.poll.execute()
    } catch {
    }
  }
}
