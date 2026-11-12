import { sql } from 'drizzle-orm'
import {
    index, pgEnum, pgTable, smallint, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { commonTimestamps, timestamptz } from '@common/db'
import {PRODUCT_STATUSES, PRODUCT_TYPES, SHOE_GENDERS, ShoeProduct} from '@api/product/domain'

import { brands } from './brand.model'
import { categories } from './category.model'

export const productStatusEnum = pgEnum('product_status', PRODUCT_STATUSES)
export const productTypeEnum = pgEnum('product_type', PRODUCT_TYPES)
export const shoeGenderEnum = pgEnum('shoe_gender', SHOE_GENDERS)

export const products = pgTable(
    'products',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        type: productTypeEnum('type').notNull(),
        name: varchar('name', { length: 200 }).notNull(),
        slug: varchar('slug', { length: 220 }).notNull(),
        description: varchar('description', { length: 5000 }).notNull(),
        status: productStatusEnum('status').notNull().default('draft'),
        categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
        brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'restrict' }),
        publishedAt: timestamptz('published_at'),
        ...commonTimestamps,
    },
    (t) => [
        uniqueIndex('products_slug_uq').on(t.slug),
        index('products_status_created_at_idx').on(t.status, t.createdAt.desc(), t.id.desc()),
        index('products_name_id_idx').on(t.name, t.id),
        index('products_category_id_idx').on(t.categoryId),
        index('products_brand_id_idx').on(t.brandId),
        index('products_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    ],
)

export const productImages = pgTable(
    'product_images',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        productId: uuid('product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'cascade' }),
        fileKey: varchar('file_key', { length: 255 }).notNull(),
        altText: varchar('alt_text', { length: 255 }),
        position: smallint('position').notNull(),
    },
    (t) => [uniqueIndex('product_images_product_position_uq').on(t.productId, t.position)],
)

export const shoeProductDetails = pgTable('shoe_product_details', {
    productId: uuid('product_id')
        .primaryKey()
        .references(() => products.id, { onDelete: 'cascade' }),
    gender: shoeGenderEnum('gender').notNull(),
    material: varchar('material', { length: 100 }),
})