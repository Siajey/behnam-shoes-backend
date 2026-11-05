import { ICountUsers } from '@api/users/application'
import { IUserRepository, ListUsersQuery } from '@api/users/domain'

export class CountUsersUsecase implements ICountUsers {
  constructor(private readonly userRepository: IUserRepository) {}

  execute(getItems: ListUsersQuery): Promise<number> {
    return this.userRepository.count(getItems)
  }
}
