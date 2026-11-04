import { Profile, User } from '@api/users/domain'

export interface IUpdateMe {
  execute(userId: string, updateDto: Partial<Profile>): Promise<Profile>
}

export interface IGetMe {
  execute(userId: string): Promise<User>
}
