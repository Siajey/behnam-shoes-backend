import { IGetUsers } from '@api/users/application'
import { IUserRepository, ListUsersQuery, User } from '@api/users/domain'

export class GetUsers implements IGetUsers {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(getItems: ListUsersQuery): Promise<{
    users: User[]
    length: number
    nextCursor?: string
  }> {
    const { users, nextCursor } = await this.userRepository.findAll(getItems)
    return {
      length: users.length,
      users: users,
      nextCursor,
    }
  }
}
