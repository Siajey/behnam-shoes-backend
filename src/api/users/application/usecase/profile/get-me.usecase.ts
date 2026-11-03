import { IGetMe } from '@api/users/application'
import { IProfileRepository, UserResponse } from '@api/users/domain'

export class GetMeUseCase implements IGetMe {
  constructor(private profileRepository: IProfileRepository) {}

  execute(userId: string): Promise<UserResponse> {
    return this.profileRepository.findById(userId)
  }
}
