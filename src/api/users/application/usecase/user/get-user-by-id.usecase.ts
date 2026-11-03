import { IGetUserById } from '@api/users/application'
import { IUserRepository, UserResponse } from '@api/users/domain'
import { isUuid } from '@common/validations'
import { ValidationError } from '@common/errors'

export class GetUserByIdUsecase implements IGetUserById {
  constructor(private userRepository: IUserRepository) {}

  execute(userId: string): Promise<UserResponse> {
    if (!isUuid(userId))
      throw new ValidationError({
        message: 'errors.validation.invalidUuid',
      })
    return this.userRepository.findByIdWithProfile(userId)
  }
}
