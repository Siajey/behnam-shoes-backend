import { UploadPolicy } from '@common/storage'

export const PRODUCT_IMAGE_UPLOAD_POLICY: UploadPolicy = {
  folder: 'products',
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeBytes: 5 * 1024 * 1024,
}
