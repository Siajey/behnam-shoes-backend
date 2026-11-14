import { sql } from 'drizzle-orm'
import {
    bigint, boolean, check, index, pgEnum, pgTable, primaryKey, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { DISCOUNT_KINDS, SCOPE_TYPES } from '@api/discount/domain'
import { commonTimestamps, timestamptz } from '@common/db'

export const discountKindEnum = pgEnum('discount_kind', DISCOUNT_KINDS)
export const discountScopeTypeEnum = pgEnum('discount_scope_type', SCOPE_TYPES)

export const discounts = pgTable(
    'discounts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: varchar('name', { length: 120 }).notNull(),
        kind: discountKindEnum('kind').notNull(),
        value: bigint('value', { mode: 'number' }).notNull(),
        maxDiscountPerUnit: bigint('max_discount_per_unit', { mode: 'number' }),
        scopeType: discountScopeTypeEnum('scope_type').notNull(),
        startsAt: timestamptz('starts_at'),
        endsAt: timestamptz('ends_at'),
        isActive: boolean('is_active').notNull().default(true),
        ...commonTimestamps,
    },
    (t) => [
        index('discounts_active_period_idx').on(t.isActive, t.startsAt, t.endsAt),
        index('discounts_created_at_idx').on(t.createdAt.desc(), t.id.desc()),
        index('discounts_name_id_idx').on(t.name, t.id),
        check('discounts_value_positive', sql`${t.value} > 0`),
        check('discounts_period_valid', sql`${t.startsAt} is null or ${t.endsAt} is null or ${t.startsAt} < ${t.endsAt}`),
    ],
)

export const discountTargets = pgTable(
    'discount_targets',
    {
        discountId: uuid('discount_id')
            .notNull()
            .references(() => discounts.id, { onDelete: 'cascade' }),
        targetId: uuid('target_id').notNull(), // a category, brand, product or variant id, no FK on purpose
    },
    (t) => [
        primaryKey({ columns: [t.discountId, t.targetId] }),
        index('discount_targets_target_id_idx').on(t.targetId),
    ],
)