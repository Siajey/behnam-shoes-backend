import { sql } from 'drizzle-orm'
import {
    boolean,
    index,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core'

import { profiles } from './profile.model'

export const addresses = pgTable(
    'addresses',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        profileId: uuid('profile_id')
            .notNull()
            .references(() => profiles.id, { onDelete: 'cascade' }),
        recipientName: varchar('recipient_name', { length: 100 }).notNull(),
        recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
        province: varchar('province', { length: 100 }).notNull(),
        city: varchar('city', { length: 100 }).notNull(),
        postalCode: varchar('postal_code', { length: 10 }).notNull(),
        addressLine: varchar('address_line', { length: 500 }).notNull(),
        isDefault: boolean('is_default').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
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
