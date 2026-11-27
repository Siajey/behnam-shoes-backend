import { UploadPolicy } from '@common/storage'

export const SETTINGS_IMAGE_UPLOAD_POLICY: UploadPolicy = {
  folder: 'settings',
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxSizeBytes: 5 * 1024 * 1024,
}
