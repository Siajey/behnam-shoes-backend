import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { commonTimestamps } from '@common/db'

export const brands = pgTable(
    'brands',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 120 }).notNull(),
        slug: varchar('slug', { length: 150 }).notNull(),
        logoKey: varchar('logo_key', { length: 255 }),
        ...commonTimestamps,
    },
    (t) => [uniqueIndex('brands_slug_uq').on(t.slug), uniqueIndex('brands_name_uq').on(t.name)],
)