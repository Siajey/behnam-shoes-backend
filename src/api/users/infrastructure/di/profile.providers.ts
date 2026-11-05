import {
    createProvider,
    GET_ME,
    PROFILE_REPOSITORY,
    UPDATE_ME,
} from '@common/di'
import {
    GetMeUseCase,
    UpdateMeUseCase,
} from '@api/users/application'

export const ProfileProviders = [
    createProvider<UpdateMeUseCase>(UPDATE_ME, UpdateMeUseCase, [
        PROFILE_REPOSITORY,
    ]),
    createProvider<GetMeUseCase>(GET_ME, GetMeUseCase, [PROFILE_REPOSITORY]),
]
