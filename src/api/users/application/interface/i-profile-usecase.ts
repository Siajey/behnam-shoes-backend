import { Profile, UserResponse } from '@api/users/domain'

export interface IUpdateMe {
  execute(userId: string, updateDto: Partial<Profile>): Promise<Profile>
}

export interface IGetMe {
  execute(userId: string): Promise<UserResponse>
}

export interface IUpdateAvatar {
  execute(
    userId: string,
    avatarFile: FileStorage.MultipartFile,
  ): Promise<string>
}

export interface IDeleteAvatar {
  execute(userId: string): Promise<void>
}
