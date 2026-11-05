import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { users } from './user.model'
import { commonTimestamps } from '@common/db'

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 20 }),
  lastName: varchar('last_name', { length: 20 }),
  userId: uuid('user_id')
    .references(() => users.id, {
      onDelete: 'cascade',
    })
    .unique(),
  ...commonTimestamps,
})

export type ProfileRow = InferSelectModel<typeof profiles>
export type NewProfile = InferInsertModel<typeof profiles>
