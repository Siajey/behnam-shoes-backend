import { IFileStorage, UploadTarget } from '@common/storage'

import { PRODUCT_IMAGE_UPLOAD_POLICY } from '../../../constants'
import {
  CreateProductImageUploadCommand,
  ICreateProductImageUpload,
} from '../../../interfaces'

export default class CreateProductImageUploadUseCase implements ICreateProductImageUpload {
  constructor(private readonly storage: IFileStorage) {}

  execute(command: CreateProductImageUploadCommand): Promise<UploadTarget> {
    return this.storage.createUploadTarget(PRODUCT_IMAGE_UPLOAD_POLICY, command)
  }
}
