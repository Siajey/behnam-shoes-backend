import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import {
  IProfileRepository,
  Profile,
  User,
  UserRole,
  UserStatus,
} from '@api/users/domain'
import { NotFoundError } from '@common/errors'
import { DATABASE } from '@common/di'
import { Database } from '@common/db'
import { stripUndefined } from '@common/util'

import { ProfileMapper } from '../mappers'
import * as profileSchema from '../models/profile.model'
import * as userSchema from '../models/user.model'

import {profiles} from "../models/profile.model";
import * as schema from "../models/user.model";


const USER_SELECT = {
    id: schema.users.id,
    phoneNumber: schema.users.phoneNumber,
    status: schema.users.status,
    role: schema.users.role,
    updatedAt: schema.users.updatedAt,
    createdAt: schema.users.createdAt,
}

const PROFILE_SELECT = {
    id: profiles.id,
    userId: profiles.userId,
    firstName: profiles.firstName,
    lastName: profiles.lastName,
    createdAt: profiles.createdAt,
    updatedAt: profiles.updatedAt,
}

@Injectable()
export class ProfileRepository implements IProfileRepository {
  constructor(
    @Inject(DATABASE) private readonly db: Database<typeof userSchema>,
  ) {}

  async findById(userId: string): Promise<User> {
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
      return new User({
        ...user,
        role: user.role as UserRole,
        status: user.status as UserStatus,
        profile: user.profile ? ProfileMapper.toDomain(user.profile) : null,
      })
    else
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
  }

  async update(userId: string, profileData: Partial<Profile>): Promise<Profile> {
    const row = stripUndefined(ProfileMapper.toPersistence(profileData))
    const [updated] = await this.db
      .insert(profileSchema.profiles)
      .values({ ...row, userId })
      .onConflictDoUpdate({
        target: profileSchema.profiles.userId,
        set: { ...row, updatedAt: new Date() },
      })
      .returning()

    return ProfileMapper.toDomain(updated)
  }
}
