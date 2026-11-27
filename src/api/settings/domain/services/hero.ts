import { normalizePersianLetters } from '@common/util'

import { InvalidSettingError } from '../errors'
import { HeroSetting, SettingValues, StoredSetting } from '../value-objects'

const MAX_ALT_TEXT = 200
const MAX_FILE_KEY = 255

export interface HeroChanges {
  imageKey?: string | null
  altText?: string | null
}

export function applyHeroChanges(current: HeroSetting, changes: HeroChanges): HeroSetting {
  let imageKey = current.imageKey
  if (changes.imageKey !== undefined) {
    const key = changes.imageKey?.trim() ?? ''
    if (changes.imageKey !== null && (key.length < 1 || key.length > MAX_FILE_KEY)) {
      throw new InvalidSettingError('imageKey')
    }
    imageKey = changes.imageKey === null ? null : key
  }

  let altText = current.altText
  if (changes.altText !== undefined) {
    const text = normalizePersianLetters((changes.altText ?? '').trim())
    if (text.length > MAX_ALT_TEXT) throw new InvalidSettingError('altText')
    altText = text.length > 0 ? text : null
  }

  return { imageKey, altText }
}

export function parseHero(raw: unknown): HeroSetting {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    imageKey: typeof value.imageKey === 'string' && value.imageKey ? value.imageKey : null,
    altText: typeof value.altText === 'string' && value.altText ? value.altText : null,
  }
}

export function resolveSettings(stored: readonly StoredSetting[]): SettingValues {
  const byKey = new Map(stored.map((s) => [s.key, s.value]))
  return {
    hero: (byKey.get('hero') as HeroSetting | undefined) ?? { imageKey: null, altText: null },
  }
}
