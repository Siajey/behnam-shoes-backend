import {
    index, integer, pgEnum, pgTable, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core'

import { TRACKING_STATUSES } from '@api/shipping/domain'
import { commonTimestamps, timestamptz } from '@common/db'


export const trackingStatusEnum = pgEnum('tracking_status', TRACKING_STATUSES)

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull(),
    methodCode: varchar('method_code', { length: 30 }).notNull(),
    carrier: varchar('carrier', { length: 30 }).notNull(),
    trackingCode: varchar('tracking_code', { length: 64 }).notNull(),
    status: trackingStatusEnum('status').notNull().default('created'),
    deliveredAt: timestamptz('delivered_at'),
    lastCheckedAt: timestamptz('last_checked_at'),
    nextCheckAt: timestamptz('next_check_at').notNull(),
    failureCount: integer('failure_count').notNull().default(0),
    version: integer('version').notNull().default(1),
    ...commonTimestamps,
  },
  (t) => [
    uniqueIndex('shipments_order_id_uq').on(t.orderId),
    index('shipments_poll_idx').on(t.status, t.nextCheckAt),
    index('shipments_delivered_at_idx').on(t.deliveredAt),
  ],
)

export const shipmentEvents = pgTable(
  'shipment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    eventKey: varchar('event_key', { length: 200 }).notNull(),
    status: trackingStatusEnum('status').notNull(),
    description: varchar('description', { length: 500 }).notNull(),
    location: varchar('location', { length: 200 }),
    occurredAt: timestamptz('occurred_at').notNull(),
  },
  (t) => [
    uniqueIndex('shipment_events_key_uq').on(t.shipmentId, t.eventKey),
    index('shipment_events_time_idx').on(t.shipmentId, t.occurredAt),
  ],
)
