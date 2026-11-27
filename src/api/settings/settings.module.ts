import { Module } from '@nestjs/common'

import { FilesModule } from '@common/files'
import { SessionModule } from '@api/session'
import { DatabaseModule } from '@common/db'
import { SETTING_REPOSITORY } from '@common/di'

import { SettingRepository, SettingsUseCaseProviders } from './infrastructure'
import { AdminSettingsController, SettingsController } from './presentation'

@Module({
  imports: [DatabaseModule, FilesModule, SessionModule],
  controllers: [SettingsController, AdminSettingsController],
  providers: [{ provide: SETTING_REPOSITORY, useClass: SettingRepository }, ...SettingsUseCaseProviders],
})
export class SettingsModule {}
