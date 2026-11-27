import {
  applyHeroChanges, DEFAULT_SETTINGS, HeroSetting, ISettingRepository,
} from '@api/settings/domain'
import { ILogger } from '@common/logger'
import { IFileStorage } from '@common/storage'

import { SETTINGS_IMAGE_UPLOAD_POLICY } from '../constants'
import { discardFile } from '../helpers'
import { IUpdateHero, UpdateHeroCommand } from '../interfaces'

export default class UpdateHeroUseCase implements IUpdateHero {
  constructor(
    private readonly settings: ISettingRepository,
    private readonly storage: IFileStorage,
    private readonly logger: ILogger,
  ) {}

  async execute(command: UpdateHeroCommand, actorId: string): Promise<HeroSetting> {
    const stored = await this.settings.find('hero')
    const current = (stored?.value as HeroSetting | undefined) ?? DEFAULT_SETTINGS.hero

    const next = applyHeroChanges(current, command)

    if (next.imageKey && next.imageKey !== current.imageKey) {
      await this.storage.verifyUploaded(SETTINGS_IMAGE_UPLOAD_POLICY, next.imageKey)
    }

    await this.settings.save({ key: 'hero', value: next, updatedAt: new Date(), updatedBy: actorId })

    if (current.imageKey !== next.imageKey) {
      await discardFile(this.storage, this.logger, current.imageKey, 'UpdateHeroUseCase')
    }

    void this.logger.info('Hero setting updated', {
      module: 'UpdateHeroUseCase',
      operation: 'execute',
      event: 'settings.hero.update',
      userId: actorId,
      data: { imageChanged: current.imageKey !== next.imageKey },
    })
    return next
  }
}
