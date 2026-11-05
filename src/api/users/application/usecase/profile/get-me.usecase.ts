import { IGetMe } from '@api/users/application'
import { IProfileRepository, User } from '@api/users/domain'

export class GetMeUseCase implements IGetMe {
  constructor(private profileRepository: IProfileRepository) {}

  execute(userId: string): Promise<User> {
    return this.profileRepository.findByIdWithAddress(userId)
  }
}
