import {IUpdateUser} from '@api/users/application'
import {IUserRepository, User} from '@api/users/domain'
import {SessionCacheService} from "@api/session/application";

export class UpdateUserUseCase implements IUpdateUser {
    constructor(private readonly userRepository: IUserRepository,
                private readonly sessionCache: SessionCacheService
    ) {
    }

    async execute(updateDTO: Partial<User>): Promise<User> {
        await this.sessionCache.invalidateUserSession(updateDTO.id)
        return this.userRepository.update(updateDTO.id, updateDTO)
    }
}
