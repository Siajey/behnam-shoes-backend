import { IUpdateUser } from '@api/users/application'
import { IUserRepository, User } from '@api/users/domain'

export class UpdateUserUseCase implements IUpdateUser {
  constructor(private readonly userRepository: IUserRepository) {}

  execute(updateDTO: Partial<User>): Promise<User> {
    return this.userRepository.update(updateDTO.id, updateDTO)
  }
}
