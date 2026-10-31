import { Module } from '@nestjs/common'

import {
  DatabaseClientProvider,
  DatabaseHealthService,
  DatabaseProvider,
  DatabaseShutdownService,
} from './infrastructure'

@Module({
  providers: [
    DatabaseProvider,
    DatabaseClientProvider,
    DatabaseShutdownService,
    DatabaseHealthService,
  ],
  exports: [DatabaseProvider, DatabaseShutdownService, DatabaseHealthService],
})
export class DatabaseModule {}
