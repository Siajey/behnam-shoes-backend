import { Inject, Injectable } from '@nestjs/common'
import { count, eq } from 'drizzle-orm'

import {
  IUserRepository,
  ListUsersQuery,
  USER_FILTER_FIELDS,
  USER_SORT_FIELDS,
  User,
} from '@api/users/domain'
import { Database, DrizzleGetItemsQueryBuilder } from '@common/db'
import { NotFoundError } from '@common/errors'
import { stripUndefined } from '@common/util'
import { DATABASE } from '@common/di'

import * as schema from '../models/user.model'
import { ProfileMapper, UserMapper } from '../mappers'
import { profiles } from '../models/profile.model'


const USER_SELECT = {
    id: schema.users.id,
    phoneNumber: schema.users.phoneNumber,
    status: schema.users.status,
    role: schema.users.role,
    updatedAt: schema.users.updatedAt,
    createdAt: schema.users.createdAt,
}

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

  delete(userId: string): Promise<object> {
    return this.db.delete(schema.users).where(eq(schema.users.id, userId))
  }

  async findAll(
    dto: ListUsersQuery,
  ): Promise<{ users: User[]; nextCursor: string | null}> {
    const builder = new DrizzleGetItemsQueryBuilder(
      dto,
      schema.users,
      USER_FILTER_FIELDS,
      USER_SORT_FIELDS,
    )
      .filter()
      .sort()
      .cursor()
      .pagination()

    const rows = await this.db
      .select(USER_SELECT)
      .from(schema.users)
      .where(builder.buildWhere())
      .orderBy(...builder.orderBy)
      .limit(builder.pageSize + 1)
    const hasMore = rows.length > builder.pageSize
    const pageRows = hasMore ? rows.slice(0, builder.pageSize) : rows

    const lastRow = pageRows[pageRows.length - 1]
    const nextCursor =
      hasMore && lastRow
        ? DrizzleGetItemsQueryBuilder.encodeCursor(
            lastRow[builder['primarySortField']],
            lastRow.id,
          )
        : null

    return {
      users: pageRows.map(UserMapper.toDomain),
      nextCursor,
    }
  }

  async count(dto: ListUsersQuery): Promise<number> {
    const builder = new DrizzleGetItemsQueryBuilder(
      dto,
      schema.users,
      USER_FILTER_FIELDS,
      USER_SORT_FIELDS,
    ).filter()
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.users)
      .where(builder.buildWhere())
    return total
  }

  async findSessionState(userId: string) {
    const [userRow] = await this.db
      .select({
        status: schema.users.status,
        role: schema.users.role,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (!userRow) throw new NotFoundError({ message: 'errors.user.notFound' })

    return userRow
  }

  async findById(userId: string): Promise<User> {
    const [userRow] = await this.db
      .select(USER_SELECT)
      .from(schema.users)
      .where(eq(schema.users.id, userId))
    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return UserMapper.toDomain(userRow)
  }

  async findByIdWithProfile(userId: string): Promise<User> {
    const [userRow] = await this.db
      .select({ ...USER_SELECT, profile: profiles })
      .from(schema.users)
      .leftJoin(profiles, eq(profiles.userId, schema.users.id))
      .where(eq(schema.users.id, userId))

    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return {
      ...UserMapper.toDomain(userRow),
      profile: userRow?.profile
        ? ProfileMapper.toDomain(userRow.profile)
        : null,
    }
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User> {
    const [userRow] = await this.db
      .select(USER_SELECT)
      .from(schema.users)
      .where(eq(schema.users.phoneNumber, phoneNumber))
    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return UserMapper.toDomain(userRow)
  }

  async save(user: User): Promise<User> {
    const [userRow] = await this.db
      .insert(schema.users)
      .values(UserMapper.toPersistence(user))
      .onConflictDoUpdate({
        target: schema.users.id,
        set: UserMapper.toPersistence(user),
      })
      .returning(USER_SELECT)

    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return UserMapper.toDomain(userRow)
  }

    async update(id: string, user: Partial<User>): Promise<User> {
        const now = new Date()
        const { profile, ...userData } = user

        const userRow = await this.db.transaction(async (tx) => {
            const [updatedUser] = await tx
                .update(schema.users)
                .set({
                    ...stripUndefined(userData),
                    updatedAt: now,
                })
                .where(eq(schema.users.id, id))
                .returning(USER_SELECT)

            if (!updatedUser) {
                throw new NotFoundError({
                    message: 'errors.user.notFound',
                })
            }

            let profileRow: typeof profiles.$inferSelect | null

            if (profile !== undefined) {
                const [savedProfile] = await tx
                    .insert(profiles)
                    .values({
                        userId: id,
                        ...stripUndefined(profile ?? {}),
                        updatedAt: now,
                    })
                    .onConflictDoUpdate({
                        target: profiles.userId,
                        set: {
                            ...stripUndefined(profile ?? {}),
                            updatedAt: now,
                        },
                    })
                    .returning()

                profileRow = savedProfile
            } else {
                const [existingProfile] = await tx
                    .select()
                    .from(profiles)
                    .where(eq(profiles.userId, id))
                    .limit(1)

                profileRow = existingProfile ?? null
            }

            return {
                ...updatedUser,
                profile: profileRow,
            }
        })

        return UserMapper.toDomainWithProfile(userRow,userRow.profile)
    }
  async updateByPhoneNumber(phoneNumber: string, user: Partial<User>): Promise<User> {
    const now = new Date()
      const [updatedUser] = await this.db
        .update(schema.users)
        .set({
          ...stripUndefined(user),
          updatedAt: now,
        })
        .where(eq(schema.users.phoneNumber, phoneNumber))
        .returning(USER_SELECT)

      if (!updatedUser)
        throw new NotFoundError({
          message: 'errors.user.notFound',
        })

      return UserMapper.toDomain(updatedUser)
    }

}
