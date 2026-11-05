import { Injectable } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'

import { DatabaseHealthService } from '@common/db'

@Injectable()
export default class DatabaseHealthIndicator {
  constructor(
    private readonly databaseHealthService: DatabaseHealthService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key)

    const isUp = await this.databaseHealthService.ping()

    if (!isUp) {
      return indicator.down({ message: 'Database ping failed' })
    }

    return indicator.up()
  }
}
