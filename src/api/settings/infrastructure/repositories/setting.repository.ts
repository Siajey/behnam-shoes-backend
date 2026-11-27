import {Inject, Injectable} from '@nestjs/common'
import {eq} from 'drizzle-orm'

import {ISettingRepository, SettingKey, StoredSetting} from '@api/settings/domain'
import {Database} from '@common/db'
import {DATABASE} from '@common/di'

import * as schema from '../models'
import {SettingMapper} from '../mappers'

@Injectable()
export class SettingRepository implements ISettingRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async findAll(): Promise<StoredSetting[]> {
        const rows = await this.db.select().from(schema.siteSettings)
        return rows.map(SettingMapper.toDomain).filter((s): s is StoredSetting => s !== null)
    }

    async find(key: SettingKey): Promise<StoredSetting | null> {
        const [row] = await this.db
            .select()
            .from(schema.siteSettings)
            .where(eq(schema.siteSettings.key, key))
            .limit(1)
        return row ? SettingMapper.toDomain(row) : null
    }

    async save(setting: StoredSetting): Promise<void> {
        const row = SettingMapper.toPersistence(setting)
        await this.db
            .insert(schema.siteSettings)
            .values(row)
            .onConflictDoUpdate({
                target: schema.siteSettings.key,
                set: {value: row.value, updatedBy: row.updatedBy, updatedAt: row.updatedAt},
            })
    }
}
