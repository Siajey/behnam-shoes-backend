import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import { IProfileRepository, Profile, UserResponse } from '@api/users/domain'
import { NotFoundError } from '@common/errors'
import { DATABASE } from '@common/di'
import { Database } from '@common/db'
import { stripUndefined } from '@common/util'

import { ProfileMapper } from '../mappers'
import * as profileSchema from '../models/profile.model'
import * as userSchema from '../models/user.model'

import { PROFILE_SELECT, USER_SELECT } from './user.repository.constants'

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Database<typeof userSchema>,
  ) {}

  async findById(userId: string): Promise<UserResponse> {
    const [user] = await this.db
      .select({
        ...USER_SELECT,
        profile: {
          ...PROFILE_SELECT,
        },
      })
      .from(userSchema.users)
      .leftJoin(
        profileSchema.profiles,
        eq(profileSchema.profiles.userId, userSchema.users.id),
      )
      .where(eq(userSchema.users.id, userId))
      .limit(1)
    if (user)
      return {
        ...user,
        profile: user?.profile ? ProfileMapper.toDomain(user.profile) : null,
      }
    else
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
  }

  async update(id: string, profileData: Partial<Profile>): Promise<Profile> {
    const row = stripUndefined(ProfileMapper.toPersistence(profileData))
    const [updated] = await this.db
      .insert(profileSchema.profiles)
      .values({ ...stripUndefined(row), userId: id })
      .onConflictDoUpdate({
        target: profileSchema.profiles.userId,
        set: row,
      })
      .returning()

    return ProfileMapper.toDomain(updated)
  }
}
