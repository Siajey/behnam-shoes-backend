export const SETTING_KEYS = ['hero'] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

export interface HeroSetting {
  imageKey: string | null
  altText: string | null
}

export interface SettingValues {
  hero: HeroSetting
}

export const DEFAULT_SETTINGS: SettingValues = {
  hero: { imageKey: null, altText: null },
}

export interface StoredSetting {
  key: SettingKey
  value: SettingValues[SettingKey]
  updatedAt: Date
  updatedBy: string | null
}
