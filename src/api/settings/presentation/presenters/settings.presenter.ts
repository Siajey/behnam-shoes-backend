import { HeroSetting, SettingValues } from '@api/settings/domain'

export type UrlOf = (fileKey: string) => string

export class SettingsPresenter {
  static toPublic(settings: SettingValues, urlOf: UrlOf) {
    return {
      hero: {
        imageUrl: settings.hero.imageKey ? urlOf(settings.hero.imageKey) : null,
        altText: settings.hero.altText,
      },
    }
  }

  static hero(hero: HeroSetting, urlOf: UrlOf) {
    return {
      imageKey: hero.imageKey,
      imageUrl: hero.imageKey ? urlOf(hero.imageKey) : null,
      altText: hero.altText,
    }
  }

  static toAdmin(settings: SettingValues, urlOf: UrlOf) {
    return { hero: SettingsPresenter.hero(settings.hero, urlOf) }
  }
}
