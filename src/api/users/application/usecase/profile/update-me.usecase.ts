import { IUpdateMe } from '@api/users/application'
import { IProfileRepository, Profile } from '@api/users/domain'

export class UpdateMeUseCase implements IUpdateMe {
  constructor(private readonly profileRepository: IProfileRepository) {}

  execute(userId: string, updateDto: Partial<Profile>): Promise<Profile> {
    return this.profileRepository.update(userId, updateDto)
  }
}
