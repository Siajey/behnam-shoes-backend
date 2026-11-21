import {sql} from 'drizzle-orm'
import {bigint, check, index, integer, pgEnum, pgTable, uniqueIndex, uuid, varchar} from 'drizzle-orm/pg-core'

import {PAYMENT_STATUSES} from '@api/payment/domain'
import {commonTimestamps, timestamptz} from '@common/db'

export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES)
export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    userId: uuid('user_id').notNull(),
    gateway: varchar('gateway', {length: 30}).notNull(),
    amount: bigint('amount', {mode: 'number'}).notNull(),
    currency: varchar('currency', {length: 3}).notNull(),
    status: paymentStatusEnum('status').notNull().default('initiated'),
    reference: varchar('reference', {length: 100}),
    trackingCode: varchar('tracking_code', {length: 100}),
    cardMask: varchar('card_mask', {length: 30}),
    failureReason: varchar('failure_reason', {length: 100}),
    paidAt: timestamptz('paid_at'),
    orderConfirmedAt: timestamptz('order_confirmed_at'),
    version: integer('version').notNull().default(1), ...commonTimestamps,
}, t => [
    uniqueIndex('payments_gateway_reference_uq').on(t.gateway, t.reference).where(sql`${t.reference}
    is not null`),
    index('payments_order_id_idx').on(t.orderId), index('payments_status_created_at_idx').on(t.status, t.createdAt),
    index('payments_unconfirmed_idx').on(t.status, t.orderConfirmedAt), check('payments_amount_positive', sql`${t.amount}
    > 0`),
])
