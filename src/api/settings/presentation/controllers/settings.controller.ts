import { Controller, Get, Header, Inject } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'

import { IGetSettings } from '@api/settings/application'
import { SuccessResponse } from '@common/api'
import { FILE_STORAGE, GET_SETTINGS } from '@common/di'
import { IFileStorage } from '@common/storage'

import { SettingsPresenter } from '../presenters'

@Controller('settings')
@Throttle({ default: { ttl: 60_000, limit: process.env.NODE_ENV === 'production' ? 120 : 10_000 } })
export default class SettingsController {
  constructor(
    @Inject(GET_SETTINGS) private readonly getSettings: IGetSettings,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
  ) {}

  private readonly urlOf = (key: string): string => this.storage.publicUrl(key)

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async getController() {
    return new SuccessResponse({
      messageObj: { message: 'common.settings.getSuccess' },
      code: 'SETTINGS_GET_SUCCESS',
      path: '/settings',
      data: SettingsPresenter.toPublic(await this.getSettings.execute(), this.urlOf),
    })
  }
}
