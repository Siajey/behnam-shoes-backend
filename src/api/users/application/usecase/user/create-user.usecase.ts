import { ICreateUser } from '@api/users/application'
import { IUserRepository, User, UserResponse } from '@api/users/domain'

export class CreateUserUseCase implements ICreateUser {
  constructor(private userRepository: IUserRepository) {}

  execute(user: User): Promise<UserResponse> {
    return this.userRepository.save(user)
  }
}
