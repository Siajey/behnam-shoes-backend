import { IDeleteMe, IDeleteUser } from '@api/users/application'

export class DeleteMeUseCase implements IDeleteMe {
  constructor(private readonly deleteUser: IDeleteUser) {}

  async execute(userId: string) {
    return this.deleteUser.execute(userId)
  }
}
