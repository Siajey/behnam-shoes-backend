import { REDEMPTION_STATUSES } from '@api/discount/domain'
import { commonTimestamps, timestamptz } from '@common/db'
import { sql } from 'drizzle-orm'
import {
    bigint, boolean, check, index, integer, pgEnum, pgTable, primaryKey, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { discountKindEnum, discountScopeTypeEnum } from './discount.model'

export const redemptionStatusEnum = pgEnum('coupon_redemption_status', REDEMPTION_STATUSES)

export const coupons = pgTable(
    'coupons',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        code: varchar('code', { length: 30 }).notNull(),
        name: varchar('name', { length: 120 }).notNull(),
        kind: discountKindEnum('kind').notNull(),
        value: bigint('value', { mode: 'number' }).notNull(),
        maxDiscount: bigint('max_discount', { mode: 'number' }),
        minOrderAmount: bigint('min_order_amount', { mode: 'number' }),
        scopeType: discountScopeTypeEnum('scope_type').notNull(),
        applyToDiscountedItems: boolean('apply_to_discounted_items').notNull().default(false),
        startsAt: timestamptz('starts_at'),
        endsAt: timestamptz('ends_at'),
        usageLimitTotal: integer('usage_limit_total'),
        usageLimitPerUser: integer('usage_limit_per_user'),
        isActive: boolean('is_active').notNull().default(true),
        ...commonTimestamps,
    },
    (t) => [
        uniqueIndex('coupons_code_uq').on(t.code),
        index('coupons_created_at_idx').on(t.createdAt.desc(), t.id.desc()),
        check('coupons_value_positive', sql`${t.value} > 0`),
    ],
)

export const couponTargets = pgTable(
    'coupon_targets',
    {
        couponId: uuid('coupon_id')
            .notNull()
            .references(() => coupons.id, { onDelete: 'cascade' }),
        targetId: uuid('target_id').notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.couponId, t.targetId] }),
        index('coupon_targets_target_id_idx').on(t.targetId),
    ],
)

export const couponRedemptions = pgTable(
    'coupon_redemptions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        couponId: uuid('coupon_id')
            .notNull()
            .references(() => coupons.id, { onDelete: 'restrict' }),
        userId: uuid('user_id').notNull(),
        orderId: uuid('order_id').notNull(),
        status: redemptionStatusEnum('status').notNull().default('reserved'),
        discountAmount: bigint('discount_amount', { mode: 'number' }).notNull(),
        ...commonTimestamps,
    },
    (t) => [
        uniqueIndex('coupon_redemptions_coupon_order_uq').on(t.couponId, t.orderId),
        index('coupon_redemptions_order_id_idx').on(t.orderId),
        index('coupon_redemptions_coupon_status_idx').on(t.couponId, t.status),
        index('coupon_redemptions_coupon_user_status_idx').on(t.couponId, t.userId, t.status),
    ],
)