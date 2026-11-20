import { z } from 'zod'

const MAX_BYTES = 5 * 1024 * 1024
const invalid = { error: 'errors.validation.invalidFieldValue' }

const upload = {
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp'], { error: 'errors.file.fileTypeNotAllowed' }),
    sizeBytes: z.number(invalid).int(invalid).min(1, invalid).max(MAX_BYTES, { error: 'errors.file.fileTooLarge' }),
}

export const CategoryImageUploadSchema = z.object(upload)
export type CategoryImageUploadBody = z.infer<typeof CategoryImageUploadSchema>

export const BrandImageUploadSchema = z.object({ kind: z.enum(['cover', 'logo'], invalid), ...upload })
export type BrandImageUploadBody = z.infer<typeof BrandImageUploadSchema>