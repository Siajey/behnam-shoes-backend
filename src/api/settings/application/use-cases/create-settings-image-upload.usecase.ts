import { IFileStorage, UploadTarget } from '@common/storage'

import { SETTINGS_IMAGE_UPLOAD_POLICY } from '../constants'
import { CreateSettingsImageUploadCommand, ICreateSettingsImageUpload } from '../interfaces'

export default class CreateSettingsImageUploadUseCase implements ICreateSettingsImageUpload {
  constructor(private readonly storage: IFileStorage) {}

  execute(command: CreateSettingsImageUploadCommand): Promise<UploadTarget> {
    return this.storage.createUploadTarget(SETTINGS_IMAGE_UPLOAD_POLICY, command)
  }
}
