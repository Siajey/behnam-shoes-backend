import { IUpdateUser } from '@api/users/application'
import { IUserRepository, User, UserResponse } from '@api/users/domain'

export class UpdateUserUseCase implements IUpdateUser {
  constructor(private readonly userRepository: IUserRepository) {}

  execute(updateDTO: Partial<User>): Promise<UserResponse> {
    return this.userRepository.update(updateDTO.id, updateDTO)
  }
}
