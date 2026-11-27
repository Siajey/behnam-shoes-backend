import { HeroSetting, SettingValues } from '@api/settings/domain'
import { UploadTarget } from '@common/storage'

export interface UpdateHeroCommand {
  imageKey?: string
  altText?: string | null
}

export interface CreateSettingsImageUploadCommand {
  contentType: string
  sizeBytes: number
}

export interface IGetSettings {
  execute(): Promise<SettingValues>
}
export interface IUpdateHero {
  execute(command: UpdateHeroCommand, actorId: string): Promise<HeroSetting>
}
export interface IRemoveHeroImage {
  execute(actorId: string): Promise<HeroSetting>
}
export interface ICreateSettingsImageUpload {
  execute(command: CreateSettingsImageUploadCommand): Promise<UploadTarget>
}
