import { SettingKey, StoredSetting } from '../value-objects'

export interface ISettingRepository {
  findAll(): Promise<StoredSetting[]>
  find(key: SettingKey): Promise<StoredSetting | null>
  save(setting: StoredSetting): Promise<void>
}
