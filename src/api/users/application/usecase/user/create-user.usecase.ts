import { ICreateUser } from '@api/users/application'
import { IUserRepository, User } from '@api/users/domain'

export class CreateUserUseCase implements ICreateUser {
  constructor(private userRepository: IUserRepository) {}

  execute(user: User): Promise<User> {
    return this.userRepository.save(user)
  }
}
