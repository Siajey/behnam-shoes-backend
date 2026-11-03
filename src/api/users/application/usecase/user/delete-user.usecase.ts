import { IDeleteUser } from '@api/users/application'
import { IUserRepository } from '@api/users/domain'
import { NotFoundError } from '@common/errors'
import { SessionCacheService } from '@api/session/application'
import { FileService } from '@common/file'

export class DeleteUserUseCase implements IDeleteUser {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionCacheService: SessionCacheService,
    private readonly fileService: FileService,
  ) {}

  async execute(userId: string) {
    const savedUser = await this.userRepository.findByIdWithProfile(userId)
    if (!savedUser)
      throw new NotFoundError({
        message: 'errors.user.notFound',
      })
    await this.sessionCacheService.invalidateUserSession(savedUser.id)
    const promises: Promise<any>[] = [this.deleteUser(savedUser.id)]

    if (savedUser?.profile?.avatar) {
      promises.push(this.deleteAvatar(savedUser.profile.avatar))
    }
    return Promise.all(promises)
  }

  private deleteUser(id: string) {
    return this.userRepository.delete(id)
  }
  private deleteAvatar(avatarPath: string) {
    return this.fileService.deleteFile([avatarPath], 'local')
  }
}
