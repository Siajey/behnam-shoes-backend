import { commonTimestamps } from '@common/db'
import { sql } from 'drizzle-orm'
import {
  bigint, boolean, check, index, integer, pgTable, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

export const shippingMethods = pgTable(
  'shipping_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 30 }).notNull(),
    name: varchar('name', { length: 60 }).notNull(),
    description: varchar('description', { length: 200 }),
    carrier: varchar('carrier', { length: 30 }).notNull(),
    service: varchar('service', { length: 50 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
    fallbackFee: bigint('fallback_fee', { mode: 'number' }),
    freeThreshold: bigint('free_threshold', { mode: 'number' }),
    handlingFee: bigint('handling_fee', { mode: 'number' }).notNull().default(0),
    ...commonTimestamps,
  },
  (t) => [
    uniqueIndex('shipping_methods_code_uq').on(t.code),
    index('shipping_methods_active_position_idx').on(t.isActive, t.position),
    check('shipping_methods_handling_fee_non_negative', sql`${t.handlingFee} >= 0`),
  ],
)
