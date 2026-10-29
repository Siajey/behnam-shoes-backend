import { Module } from '@nestjs/common'

import { CustomConfigModule } from '@common/configuration'
import { AppLoggerModule } from '@common/logger'

@Module({
  imports: [CustomConfigModule, AppLoggerModule],
  providers: [],
})
export class AppModule {}
