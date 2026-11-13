import { sql } from 'drizzle-orm'
import {
    check, index, integer, pgTable, primaryKey, smallint, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { commonTimestamps, timestamptz } from '@common/db'

import { users } from '@api/users/infrastructure/models/user.model'

export const carts = pgTable(
    'carts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        couponCode: varchar('coupon_code', { length: 50 }),
        version: integer('version').notNull().default(1),
        ...commonTimestamps,
    },
    (t) => [uniqueIndex('carts_user_id_uq').on(t.userId), index('carts_updated_at_idx').on(t.updatedAt)],
)

export const cartItems = pgTable(
    'cart_items',
    {
        cartId: uuid('cart_id')
            .notNull()
            .references(() => carts.id, { onDelete: 'cascade' }),
        variantId: uuid('variant_id').notNull(),
        quantity: smallint('quantity').notNull(),
        addedAt: timestamptz('added_at').notNull().defaultNow(),
    },
    (t) => [
        primaryKey({ columns: [t.cartId, t.variantId] }),
        index('cart_items_variant_id_idx').on(t.variantId),
        check('cart_items_quantity_positive', sql`${t.quantity} > 0`),
    ],
)