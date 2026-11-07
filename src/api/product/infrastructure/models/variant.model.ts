import { sql } from 'drizzle-orm'
import {
    bigint, boolean, check, index, integer, pgTable, primaryKey, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { commonTimestamps } from '@common/db'

import { products } from './product.model'

export const variants = pgTable(
    'variants',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        title: varchar('title', { length: 255 }).notNull(),
        source: varchar('source', { length: 50 }).notNull(),
        externalId: varchar('external_id', { length: 100 }).notNull(),
        sku: varchar('sku', { length: 100 }).notNull(),
        price: bigint('price', { mode: 'number' }).notNull(),
        stock: integer('stock').notNull(),
        isActive: boolean('is_active').notNull().default(true),
        productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
        ...commonTimestamps,
    },
    (t) => [
        uniqueIndex('variants_source_external_id_uq').on(t.source, t.externalId),
        index('variants_product_id_idx').on(t.productId),
        index('variants_sku_idx').on(t.sku),
        index('variants_unassigned_idx')
            .on(t.createdAt.desc(), t.id.desc())
            .where(sql`${t.productId} is null`),
        check('variants_price_non_negative', sql`${t.price} >= 0`),
        check('variants_stock_non_negative', sql`${t.stock} >= 0`),
    ],
)

export const variantAttributes = pgTable(
    'variant_attributes',
    {
        variantId: uuid('variant_id')
            .notNull()
            .references(() => variants.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 50 }).notNull(),
        value: varchar('value', { length: 100 }).notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.variantId, t.name] }),
        index('variant_attributes_name_value_idx').on(t.name, t.value),
    ],
)