import { Profile, UserResponse } from '@api/users/domain'

export interface IProfileRepository {
  update(id: string, user: Partial<Profile>): Promise<Profile>

  findById(userId: string): Promise<UserResponse>
}
