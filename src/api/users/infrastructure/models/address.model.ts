import { sql } from 'drizzle-orm'
import {
    boolean,
    index,
    pgTable,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core'

import { profiles } from './profile.model'
import {commonTimestamps} from "@common/db";

export const addresses = pgTable(
    'addresses',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        profileId: uuid('profile_id')
            .notNull()
            .references(() => profiles.id, { onDelete: 'cascade' }),
        province: varchar('province', { length: 100 }).notNull(),
        city: varchar('city', { length: 100 }).notNull(),
        street: varchar('street', { length: 50 }).notNull(),
        postalCode: varchar('postal_code', { length: 10 }).notNull(),
        isDefault: boolean('is_default').notNull().default(false),
        ...commonTimestamps,
    },
    (table) => [
        index('addresses_profile_id_idx').on(table.profileId),
        uniqueIndex('addresses_one_default_per_profile_uidx')
            .on(table.profileId)
            .where(sql`${table.isDefault} = true`),
    ],
)

export type AddressRow = typeof addresses.$inferSelect
export type NewAddressRow = typeof addresses.$inferInsert
