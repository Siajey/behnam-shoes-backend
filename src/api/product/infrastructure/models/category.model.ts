import { AnyPgColumn, index, integer, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'

import { commonTimestamps } from '@common/db'

export const categories = pgTable(
    'categories',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 120 }).notNull(),
        slug: varchar('slug', { length: 150 }).notNull(),
        parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
            onDelete: 'restrict',
        }),
        sortOrder: integer('sort_order').notNull().default(0),
        ...commonTimestamps,
    },
    (t) => [
        uniqueIndex('categories_slug_uq').on(t.slug),
        index('categories_parent_id_idx').on(t.parentId),
    ],
)