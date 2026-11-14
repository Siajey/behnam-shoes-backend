import { z } from 'zod'

import { MAX_CART_LINES, MAX_QUANTITY_PER_LINE } from '@api/cart/domain'
import {uuidSchema} from "@common/validations";

const invalid = { error: 'errors.validation.invalidFieldValue' }

const quantity = z.coerce
    .number(invalid)
    .int(invalid)
    .min(1, { error: 'errors.validation.mustBePositive' })
    .max(MAX_QUANTITY_PER_LINE, invalid)

export const AddCartItemSchema = z.object({
    variantId: uuidSchema,
    quantity: quantity.default(1),
})
export type AddCartItemBody = z.infer<typeof AddCartItemSchema>

export const SetCartItemQuantitySchema = z.object({ quantity })
export type SetCartItemQuantityBody = z.infer<typeof SetCartItemQuantitySchema>

export const MergeCartSchema = z.object({
    items: z
        .array(z.object({ variantId: uuidSchema, quantity }))
        .min(1, { error: 'errors.validation.minItems' })
        .max(MAX_CART_LINES, { error: 'errors.validation.maxItems' }),
})
export type MergeCartBody = z.infer<typeof MergeCartSchema>

export const ApplyCouponSchema = z.object({
    code: z
        .string({ error: 'errors.validation.requiredField' })
        .trim()
        .min(3, { error: 'errors.validation.minLengthString' })
        .max(30, { error: 'errors.validation.maxLengthString' }),
})
export type ApplyCouponBody = z.infer<typeof ApplyCouponSchema>
