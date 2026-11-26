import { sql } from 'drizzle-orm'
import {
  check, index, integer, pgTable, text, uniqueIndex, uuid, varchar, boolean,
} from 'drizzle-orm/pg-core'

import { commonTimestamps, timestamptz } from '@common/db'

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull(),
    userId: uuid('user_id').notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    displayName: varchar('display_name', { length: 40 }),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    replyText: varchar('reply_text', { length: 1000 }),
    repliedAt: timestamptz('replied_at'),
    repliedBy: uuid('replied_by'),
    version: integer('version').notNull().default(1),
    ...commonTimestamps,
  },
  (t) => [
    uniqueIndex('reviews_user_product_uq').on(t.userId, t.productId),
    index('reviews_product_created_idx').on(t.productId, t.createdAt, t.id),
    index('reviews_created_idx').on(t.createdAt, t.id),
    check('reviews_rating_range', sql`${t.rating} between 1 and 5`),
  ],
)
