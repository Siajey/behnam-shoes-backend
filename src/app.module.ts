import { Module } from '@nestjs/common'

import { CustomConfigModule } from '@common/configuration'

@Module({
  imports: [CustomConfigModule],
  providers: [],
})
export class AppModule {}
