import {
    createProvider,
    GET_ME, GET_SHIPPING_INFO,
    PROFILE_REPOSITORY,
    UPDATE_ME,
} from '@common/di'
import {
    GetMeUseCase, GetShippingInfoUseCase,
    UpdateMeUseCase,
} from '@api/users/application'

export const ProfileProviders = [
    createProvider<UpdateMeUseCase>(UPDATE_ME, UpdateMeUseCase, [
        PROFILE_REPOSITORY,
    ]),
    createProvider<GetMeUseCase>(GET_ME, GetMeUseCase, [PROFILE_REPOSITORY]),
    createProvider<GetShippingInfoUseCase>(GET_SHIPPING_INFO, GetShippingInfoUseCase, [PROFILE_REPOSITORY]),
]
