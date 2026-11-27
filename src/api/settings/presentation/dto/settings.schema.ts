import { SETTINGS_IMAGE_UPLOAD_POLICY } from '@api/settings/application'
import { isNonEmptyBody, requiredText } from '@common/validations'
import { z } from 'zod'

const invalid = { error: 'errors.validation.invalidFieldValue' }

export const CreateSettingsImageUploadSchema = z.object({
  contentType: z.enum(SETTINGS_IMAGE_UPLOAD_POLICY.allowedContentTypes as [string, ...string[]], {
    error: 'errors.file.fileTypeNotAllowed',
  }),
  sizeBytes: z
    .number(invalid)
    .int(invalid)
    .min(1, { error: 'errors.validation.mustBePositive' })
    .max(SETTINGS_IMAGE_UPLOAD_POLICY.maxSizeBytes, { error: 'errors.file.fileTooLarge' }),
})
export type CreateSettingsImageUploadBody = z.infer<typeof CreateSettingsImageUploadSchema>

export const UpdateHeroSchema = z
  .object({
    imageKey: z.string().trim().min(1, invalid).max(255, invalid).optional(),
    altText: requiredText(200).nullable().optional(),
  })
  .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' })
export type UpdateHeroBody = z.infer<typeof UpdateHeroSchema>
