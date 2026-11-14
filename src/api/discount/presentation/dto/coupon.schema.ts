import { z } from 'zod'

import { DISCOUNT_KINDS } from '@api/discount/domain'
import { isNonEmptyBody, requiredText } from '@common/validations'

import { amountSchema, dateSchema, scopeSchema } from './discount.schema'

const invalid = { error: 'errors.validation.invalidFieldValue' }
const limit = z.number(invalid).int(invalid).min(1, { error: 'errors.validation.mustBePositive' })

export const CreateCouponSchema = z.object({
    code: z
        .string({ error: 'errors.validation.requiredField' })
        .trim()
        .min(3, { error: 'errors.validation.minLengthString' })
        .max(30, { error: 'errors.validation.maxLengthString' }),
    name: requiredText(120),
    kind: z.enum(DISCOUNT_KINDS, invalid),
    value: amountSchema,
    maxDiscount: amountSchema.nullish(),
    minOrderAmount: amountSchema.nullish(),
    scope: scopeSchema,
    applyToDiscountedItems: z.boolean(invalid).optional(),
    startsAt: dateSchema.nullish(),
    endsAt: dateSchema.nullish(),
    usageLimitTotal: limit.nullish(),
    usageLimitPerUser: limit.nullish(),
    isActive: z.boolean(invalid).optional(),
})
export type CreateCouponBody = z.infer<typeof CreateCouponSchema>

export const EditCouponSchema = z
    .object({
        name: requiredText(120).optional(),
        kind: z.enum(DISCOUNT_KINDS, invalid).optional(),
        value: amountSchema.optional(),
        maxDiscount: amountSchema.nullable().optional(),
        minOrderAmount: amountSchema.nullable().optional(),
        scope: scopeSchema.optional(),
        applyToDiscountedItems: z.boolean(invalid).optional(),
        startsAt: dateSchema.nullable().optional(),
        endsAt: dateSchema.nullable().optional(),
        usageLimitTotal: limit.nullable().optional(),
        usageLimitPerUser: limit.nullable().optional(),
        isActive: z.boolean(invalid).optional(),
    })
    .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' })
export type EditCouponBody = z.infer<typeof EditCouponSchema>