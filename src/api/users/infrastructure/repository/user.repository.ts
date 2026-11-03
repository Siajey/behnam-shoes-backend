import { Inject, Injectable } from '@nestjs/common'
import { count, eq, or } from 'drizzle-orm'

import {
  IUserRepository,
  ListUsersQuery,
  Profile,
  User,
  USER_FILTER_FIELDS,
  USER_SORT_FIELDS,
  UserResponse,
} from '@api/users/domain'
import { Database, DrizzleGetItemsQueryBuilder } from '@common/db'
import { NotFoundError } from '@common/errors'
import { stripUndefined } from '@common/util'
import { DATABASE } from '@common/di'

import * as schema from '../models/user.model'
import { ProfileMapper, UserMapper } from '../mappers'
import { profiles } from '../models/profile.model'
import { USER_SELECT } from './user.repository.constants'

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {}

  delete(userId: string): Promise<object> {
    return this.db.delete(schema.users).where(eq(schema.users.id, userId))
  }

  async findAll(
    dto: ListUsersQuery,
  ): Promise<{ users: User[]; nextCursor?: string }> {
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

  async findForLogin(value: string) {
    const [userRow] = await this.db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status,
        updatedAt: schema.users.updatedAt,
        passwordChangedAt: schema.users.passwordChangedAt,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(
        or(eq(schema.users.email, value), eq(schema.users.username, value)),
      )
      .limit(1)

    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return userRow
  }

  async findForResetPassword(value: string) {
    const [userRow] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        passwordTokenExpires: schema.users.passwordTokenExpires,
        passwordResetToken: schema.users.passwordResetToken,
      })
      .from(schema.users)
      .where(eq(schema.users.passwordResetToken, value))
      .limit(1)

    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return userRow
  }

  async findForChangePassword(userId: string) {
    const [userRow] = await this.db
      .select({
        id: schema.users.id,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return userRow
  }

  async findContactByEmail(email: string) {
    const [userRow] = await this.db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)

    return userRow ?? null
  }

  async findSessionState(userId: string) {
    const [userRow] = await this.db
      .select({
        status: schema.users.status,
        role: schema.users.role,
        passwordChangedAt: schema.users.passwordChangedAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    if (!userRow) throw new NotFoundError({ message: 'errors.user.notFound' })

    return userRow
  }

  async findById(userId: string): Promise<UserResponse> {
    const [userRow] = await this.db
      .select(USER_SELECT)
      .from(schema.users)
      .where(eq(schema.users.id, userId))
    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return userRow
  }

  async findByIdWithProfile(userId: string): Promise<UserResponse> {
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
      ...userRow,
      profile: userRow?.profile
        ? ProfileMapper.toDomain(userRow.profile)
        : undefined,
    }
  }

  async findByEmail(email: string): Promise<UserResponse> {
    const [userRow] = await this.db
      .select(USER_SELECT)
      .from(schema.users)
      .where(eq(schema.users.email, email))
    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return userRow
  }

  async save(user: User): Promise<UserResponse> {
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
    return userRow
  }

  async update(id: string, user: Partial<User>): Promise<UserResponse> {
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

      if (!updatedUser)
        throw new NotFoundError({
          message: 'errors.user.notFound',
        })
      let savedProfile: Profile | undefined
      if (user.profile) {
        ;[savedProfile] = await tx
          .insert(profiles)
          .values({
            userId: id,
            ...stripUndefined(profile),
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: profiles.userId,
            set: {
              ...stripUndefined(profile),
              updatedAt: now,
            },
          })
          .returning()
      }

      return { ...updatedUser, profile: savedProfile } as UserResponse
    })

    if (!userRow)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    return userRow
  }
}
