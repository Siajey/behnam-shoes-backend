import { NewProfile, ProfileRow } from '../models/profile.model'
import { Profile } from '@api/users/domain'

export class ProfileMapper {
  static toDomain(row: ProfileRow): Profile {
    return {
      id: row.id,
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  static toPersistence(profile: Partial<Profile>): NewProfile {
    return {
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
    }
  }
}
