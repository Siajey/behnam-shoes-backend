import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common'

import { APP_LOGGER_SERVICE, DATABASE_CLIENT } from '@common/di'
import { ILogger } from '@common/logger'

@Injectable()
export class DatabaseShutdownService implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly client: any,
    @Inject(APP_LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  async onApplicationShutdown(signal?: string) {
    try {
      if (typeof this.client.end === 'function') {
        await this.client.end()
      } else if (typeof this.client.close === 'function') {
        await this.client.close()
      }

      this.logger.info('Database connection closed successfully', {
        module: 'DatabaseShutdownService',
        event: 'db.disconnect',
        operation: 'shutdown',
        data: {
          signal,
        },
      })
    } catch (error) {
      this.logger.error('Failed to close database connection', {
        module: 'DatabaseShutdownService',
        event: 'db.disconnect',
        operation: 'shutdown',
        err: error,
        data: {
          signal,
        },
      })
    }
  }
}
