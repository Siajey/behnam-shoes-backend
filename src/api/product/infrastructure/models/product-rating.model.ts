import { integer, numeric, pgTable, uuid } from 'drizzle-orm/pg-core'

import { timestamptz } from '@common/db'

import { products } from './product.model'

export const productRatings = pgTable('product_ratings', {
  productId: uuid('product_id')
    .primaryKey()
    .references(() => products.id, { onDelete: 'cascade' }),
  average: numeric('average', { precision: 3, scale: 1, mode: 'number' }).notNull(),
  count: integer('count').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
})
