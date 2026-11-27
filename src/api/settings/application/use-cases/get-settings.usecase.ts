import { ISettingRepository, resolveSettings, SettingValues } from '@api/settings/domain'

import { IGetSettings } from '../interfaces'

export default class GetSettingsUseCase implements IGetSettings {
  constructor(private readonly settings: ISettingRepository) {}

  async execute(): Promise<SettingValues> {
    return resolveSettings(await this.settings.findAll())
  }
}
