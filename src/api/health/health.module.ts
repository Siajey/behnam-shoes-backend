import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

import SessionModule from '@api/session/session.module'
import {
  DatabaseHealthIndicator,
  HealthController,
  RedisHealthIndicator,
} from '@api/health/presentation'
import { SenderModule } from '@common/sender'
import { DatabaseModule } from '@common/db'

@Module({
  imports: [
    TerminusModule,
    SessionModule,
    SenderModule,
    DatabaseModule,
  ],
  controllers: [HealthController],
  providers: [
    RedisHealthIndicator,
    DatabaseHealthIndicator,
  ],
})
export class HealthModule {}
