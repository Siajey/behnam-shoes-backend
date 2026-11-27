import { parseHero, StoredSetting } from '@api/settings/domain'

import { siteSettings } from '../models'

export class SettingMapper {
  static toDomain(row: typeof siteSettings.$inferSelect): StoredSetting | null {
    switch (row.key) {
      case 'hero':
        return {
          key: 'hero',
          value: parseHero(row.value),
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        }
      default:
        return null
    }
  }

  static toPersistence(s: StoredSetting): typeof siteSettings.$inferInsert {
    return {
      key: s.key,
      value: s.value,
      updatedBy: s.updatedBy,
      updatedAt: s.updatedAt,
    }
  }
}
