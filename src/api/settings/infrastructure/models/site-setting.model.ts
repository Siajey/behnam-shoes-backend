import { jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'

import { commonTimestamps } from '@common/db'

export const siteSettings = pgTable('site_settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedBy: uuid('updated_by'),
  ...commonTimestamps,
})
