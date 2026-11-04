import { index, pgEnum, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { commonTimestamps } from '@common/db'
import {UserRole, UserStatus} from "@api/users/domain"

export const userRoleEnum = pgEnum(
  'user_role',
  Object.values(UserRole) as [string, ...string[]],
)
export const userStatusEnum = pgEnum(
  'user_status',
  Object.values(UserStatus) as [string, ...string[]],
)

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull(),
    ...commonTimestamps,
  },
  (table) => ({
    createdAtIdIdx: index('idx_users_created_at_id').on(
      table.createdAt,
      table.id,
    ),
  }),
)

export type UserRow = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
