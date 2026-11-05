import { IUpdateMe } from '@api/users/application'
import {Address, IProfileRepository, Profile} from '@api/users/domain'

export class UpdateMeUseCase implements IUpdateMe {
  constructor(private readonly profileRepository: IProfileRepository) {}

  execute(userId: string, updateDto: Partial< Partial<Profile> & { address?: Address }>): Promise< Partial<Profile> & { address?: Address }> {
    return this.profileRepository.updateMe(userId, updateDto)
  }
}
