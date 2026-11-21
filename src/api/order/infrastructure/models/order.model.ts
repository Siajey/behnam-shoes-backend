import { ORDER_STATUSES } from '@api/order/domain'
import { commonTimestamps, timestamptz } from '@common/db'
import { sql } from 'drizzle-orm'
import {
    bigint, check, index, integer, jsonb, pgEnum, pgTable, smallint, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES)

export const orders = pgTable(
    'orders',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        orderNumber: integer('order_number').generatedAlwaysAsIdentity({ startWith: 100001 }),
        userId: uuid('user_id').notNull(),
        status: orderStatusEnum('status').notNull().default('pending_payment'),
        currency: varchar('currency', { length: 3 }).notNull(),
        shippingFee: bigint('shipping_fee', { mode: 'number' }).notNull().default(0),
        couponId: uuid('coupon_id'),
        couponCode: varchar('coupon_code', { length: 30 }),
        shipProvince: varchar('ship_province', { length: 100 }).notNull(),
        shipCity: varchar('ship_city', { length: 100 }).notNull(),
        shipStreet: varchar('ship_street', { length: 300 }).notNull(),
        shipPostalCode: varchar('ship_postal_code', { length: 10 }).notNull(),
        recipientFirstName: varchar('recipient_first_name', { length: 100 }).notNull(),
        recipientLastName: varchar('recipient_last_name', { length: 100 }).notNull(),
        recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
        carrier: varchar('carrier', { length: 100 }),
        trackingCode: varchar('tracking_code', { length: 100 }),
        idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
        expiresAt: timestamptz('expires_at').notNull(),
        paidAt: timestamptz('paid_at'),
        version: integer('version').notNull().default(1),
        ...commonTimestamps,
    },
    (t) => [
        uniqueIndex('orders_order_number_uq').on(t.orderNumber),
        uniqueIndex('orders_user_idempotency_uq').on(t.userId, t.idempotencyKey),
        index('orders_user_created_at_idx').on(t.userId, t.createdAt.desc(), t.id.desc()),
        index('orders_status_created_at_idx').on(t.status, t.createdAt.desc(), t.id.desc()),
        index('orders_status_expires_at_idx').on(t.status, t.expiresAt),
        index('orders_paid_at_idx').on(t.paidAt),
        check('orders_shipping_fee_non_negative', sql`${t.shippingFee} >= 0`),
    ],
)

export const orderLines = pgTable(
    'order_lines',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        orderId: uuid('order_id')
            .notNull()
            .references(() => orders.id, { onDelete: 'cascade' }),
        position: smallint('position').notNull(),
        variantId: uuid('variant_id').notNull(),
        productId: uuid('product_id').notNull(),
        productName: varchar('product_name', { length: 200 }).notNull(),
        productSlug: varchar('product_slug', { length: 220 }).notNull(),
        imageKey: varchar('image_key', { length: 255 }),
        sku: varchar('sku', { length: 100 }).notNull(),
        externalSource: varchar('external_source', { length: 50 }).notNull(),
        externalId: varchar('external_id', { length: 100 }).notNull(),
        attributes: jsonb('attributes')
            .$type<{ name: string; value: string }[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        quantity: smallint('quantity').notNull(),
        originalUnitPrice: bigint('original_unit_price', { mode: 'number' }).notNull(),
        unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
        couponAllocation: bigint('coupon_allocation', { mode: 'number' }).notNull().default(0),
    },
    (t) => [
        uniqueIndex('order_lines_order_variant_uq').on(t.orderId, t.variantId),
        index('order_lines_variant_id_idx').on(t.variantId),
        check('order_lines_quantity_positive', sql`${t.quantity} > 0`),
    ],
)

export const orderStatusEvents = pgTable(
    'order_status_events',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        orderId: uuid('order_id')
            .notNull()
            .references(() => orders.id, { onDelete: 'cascade' }),
        status: orderStatusEnum('status').notNull(),
        note: varchar('note', { length: 500 }),
        actorId: uuid('actor_id'),
        createdAt: timestamptz('created_at').notNull().defaultNow(),
    },
    (t) => [index('order_status_events_order_created_idx').on(t.orderId, t.createdAt)],
)