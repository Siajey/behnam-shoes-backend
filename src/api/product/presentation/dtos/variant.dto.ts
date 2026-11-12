import { z } from 'zod'

import { cursorSchema, pageSizeSchema, uuidSchema } from '@common/validations'

import { NewProductSchema } from './product.dto'

const variantIds = z
    .array(uuidSchema)
    .min(1, { error: 'errors.validation.minItems' })
    .max(200, { error: 'errors.validation.maxItems' })

export const UnassignedVariantsQuerySchema = z.object({
    pageSize: pageSizeSchema.optional(),
    nextCursor: cursorSchema.optional(),
})
export type UnassignedVariantsQuery = z.infer<typeof UnassignedVariantsQuerySchema>

export const VariantIdsSchema = z.object({ variantIds })
export type VariantIdsBody = z.infer<typeof VariantIdsSchema>

export const MergeProductsSchema = z.object({ sourceProductId: uuidSchema })
export type MergeProductsBody = z.infer<typeof MergeProductsSchema>

export const SplitProductSchema = z.object({ variantIds, newProduct: NewProductSchema })
export type SplitProductBody = z.infer<typeof SplitProductSchema>