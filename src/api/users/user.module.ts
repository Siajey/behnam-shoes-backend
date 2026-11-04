import {Module} from '@nestjs/common'

import {
    AddressProviders, AddressRepository,
    ProfileProviders,
    ProfileRepository,
    UserRepository,
    UserUseCaseProviders,
} from '@api/users/infrastructure'
import {ADDRESS_REPOSITORY, PROFILE_REPOSITORY, USER_REPOSITORY} from '@common/di'
import {ProfileController, UserController} from '@api/users/presentation'
import SessionModule from '@api/session/session.module'
import {DatabaseModule} from '@common/db'

@Module({
    imports: [SessionModule, DatabaseModule],
    controllers: [UserController, ProfileController],
    providers: [
        {provide: USER_REPOSITORY, useClass: UserRepository},
        {provide: PROFILE_REPOSITORY, useClass: ProfileRepository},
        {provide: ADDRESS_REPOSITORY, useClass: AddressRepository},
        ...UserUseCaseProviders,
        ...ProfileProviders,
        ...AddressProviders
    ],
    exports: [...UserUseCaseProviders, USER_REPOSITORY],
})
export default class UserModule {
}
