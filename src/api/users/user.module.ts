import { Module } from '@nestjs/common'

import {
  ProfileProviders,
  ProfileRepository,
  UserRepository,
  UserUseCaseProviders,
} from '@api/users/infrastructure'
import { PROFILE_REPOSITORY, USER_REPOSITORY } from '@common/di'
import { ProfileController, UserController } from '@api/users/presentation'
import SessionModule from '@api/session/session.module'
import { DatabaseModule } from '@common/db'

@Module({
  imports: [SessionModule, DatabaseModule],
  controllers: [UserController, ProfileController],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: PROFILE_REPOSITORY, useClass: ProfileRepository },
    ...UserUseCaseProviders,
    ...ProfileProviders,
  ],
  exports: [...UserUseCaseProviders, USER_REPOSITORY],
})
export default class UserModule {}
