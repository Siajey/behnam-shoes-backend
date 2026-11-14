import { index, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { users } from '@api/users/infrastructure'
import { timestamptz } from '@common/db'

export const favorites = pgTable(
    'favorites',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        // product_id has no foreign key, to keep the module boundary clean, as in the cart.
        productId: uuid('product_id').notNull(),
        createdAt: timestamptz('created_at').notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex('favorites_user_product_uq').on(t.userId, t.productId),
        index('favorites_user_created_at_idx').on(t.userId, t.createdAt.desc(), t.id.desc()),
    ],
)