import { Profile, User } from '@api/users/domain'

export interface IProfileRepository {
  update(id: string, user: Partial<Profile>): Promise<Profile>

  findById(userId: string): Promise<User>
}
