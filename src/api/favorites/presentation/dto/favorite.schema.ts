import { z } from 'zod'

import { MAX_FAVORITES } from '@api/favorites/domain'
import { uuidSchema } from '@common/validations'

const invalid = { error: 'errors.validation.invalidFieldValue' }

export const ListFavoritesQuerySchema = z.object({
    pageSize: z.coerce
        .number(invalid)
        .int(invalid)
        .min(1, { error: 'errors.validation.mustBePositive' })
        .max(50, invalid)
        .optional(),
    nextCursor: z.string().trim().min(1, invalid).max(200, invalid).optional(),
})
export type ListFavoritesQueryDto = z.infer<typeof ListFavoritesQuerySchema>

export const MergeFavoritesSchema = z.object({
    productIds: z
        .array(uuidSchema)
        .min(1, { error: 'errors.validation.minItems' })
        .max(MAX_FAVORITES, { error: 'errors.validation.maxItems' }),
})
export type MergeFavoritesBody = z.infer<typeof MergeFavoritesSchema>