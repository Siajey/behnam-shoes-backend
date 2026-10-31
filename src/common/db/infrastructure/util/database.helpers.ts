import { HasDefault, NotNull } from 'drizzle-orm'
import { PgTimestampBuilderInitial, timestamp } from 'drizzle-orm/pg-core'

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true })

export const commonTimestamps: {
  createdAt: HasDefault<NotNull<PgTimestampBuilderInitial<string>>>
  updatedAt: HasDefault<NotNull<PgTimestampBuilderInitial<string>>>
} = {
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
}
