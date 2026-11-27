import {
  CREATE_SETTINGS_IMAGE_UPLOAD, createProvider, FILE_STORAGE, GET_SETTINGS, REMOVE_HERO_IMAGE,
  SETTING_REPOSITORY, UPDATE_HERO,
} from '@common/di'

import {
  CreateSettingsImageUploadUseCase, GetSettingsUseCase, RemoveHeroImageUseCase, UpdateHeroUseCase,
} from '@api/settings/application'

export const SettingsUseCaseProviders = [
  createProvider<GetSettingsUseCase>(GET_SETTINGS, GetSettingsUseCase, [SETTING_REPOSITORY]),
  createProvider<UpdateHeroUseCase>(UPDATE_HERO, UpdateHeroUseCase, [SETTING_REPOSITORY, FILE_STORAGE]),
  createProvider<RemoveHeroImageUseCase>(REMOVE_HERO_IMAGE, RemoveHeroImageUseCase, [
    SETTING_REPOSITORY, FILE_STORAGE,
  ]),
  createProvider<CreateSettingsImageUploadUseCase>(
    CREATE_SETTINGS_IMAGE_UPLOAD, CreateSettingsImageUploadUseCase, [FILE_STORAGE],
  ),
]
