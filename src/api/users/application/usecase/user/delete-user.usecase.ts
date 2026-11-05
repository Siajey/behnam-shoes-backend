import {IDeleteUser} from '@api/users/application'
import {IUserRepository} from '@api/users/domain'
import {NotFoundError} from '@common/errors'
import {SessionCacheService} from '@api/session/application'

export class DeleteUserUseCase implements IDeleteUser {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly sessionCacheService: SessionCacheService
    ) {
    }

    async execute(userId: string) {
        const savedUser = await this.userRepository.findByIdWithProfile(userId)
        if (!savedUser)
            throw new NotFoundError({
                message: 'errors.user.notFound',
            })
        await this.sessionCacheService.invalidateUserSession(savedUser.id)
        const promises: Promise<any>[] = [this.deleteUser(savedUser.id)]

        return Promise.all(promises)
    }

    private deleteUser(id: string) {
        return this.userRepository.delete(id)
    }

}
