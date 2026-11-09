import {IUpdateUser} from '@api/users/application'
import {IUserRepository, User} from '@api/users/domain'
import {SessionCacheService} from "@api/session/application";
import {NotFoundError} from "@common/errors";

export class UpdateUserUseCase implements IUpdateUser {
    constructor(private readonly userRepository: IUserRepository,
                private readonly sessionCache: SessionCacheService
    ) {
    }

    async execute(updateDTO: Partial<User>): Promise<User> {
        if (!updateDTO.id) throw new NotFoundError({message: 'errors.useNotFound'})
        await this.sessionCache.invalidateUserSession(updateDTO.id)
        return this.userRepository.update(updateDTO.id, updateDTO)
    }
}
