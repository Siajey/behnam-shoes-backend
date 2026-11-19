import { UploadTarget } from '@common/storage'

export interface CreateProductImageUploadCommand {
  contentType: string
  sizeBytes: number
}

export interface ICreateProductImageUpload {
  execute(command: CreateProductImageUploadCommand): Promise<UploadTarget>
}
