import {
  applyHeroChanges, DEFAULT_SETTINGS, HeroSetting, ISettingRepository,
} from '@api/settings/domain'
import { ILogger } from '@common/logger'
import { IFileStorage } from '@common/storage'

import { discardFile } from '../helpers'
import { IRemoveHeroImage } from '../interfaces'

export default class RemoveHeroImageUseCase implements IRemoveHeroImage {
  constructor(
    private readonly settings: ISettingRepository,
    private readonly storage: IFileStorage,
    private readonly logger: ILogger,
  ) {}

  async execute(actorId: string): Promise<HeroSetting> {
    const stored = await this.settings.find('hero')
    const current = (stored?.value as HeroSetting | undefined) ?? DEFAULT_SETTINGS.hero

    const next = applyHeroChanges(current, { imageKey: null, altText: null })
    await this.settings.save({ key: 'hero', value: next, updatedAt: new Date(), updatedBy: actorId })
    await discardFile(this.storage, this.logger, current.imageKey, 'RemoveHeroImageUseCase')

    void this.logger.info('Hero image removed', {
      module: 'RemoveHeroImageUseCase',
      operation: 'execute',
      event: 'settings.hero.remove',
      userId: actorId,
    })
    return next
  }
}
