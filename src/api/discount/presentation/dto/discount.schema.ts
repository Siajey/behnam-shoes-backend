import { z } from 'zod'

import { DISCOUNT_KINDS, MAX_SCOPE_TARGETS, SCOPE_TYPES } from '@api/discount/domain'
import { cursorSchema, isNonEmptyBody, pageSizeSchema, requiredText, uuidSchema } from '@common/validations'

const invalid = { error: 'errors.validation.invalidFieldValue' }

export const dateSchema = z
    .iso.datetime({ offset: true, error: 'errors.validation.invalidFieldValue' })
    .transform((s) => new Date(s))

export const amountSchema = z
    .number(invalid)
    .int(invalid)
    .min(1, { error: 'errors.validation.mustBePositive' })

export const scopeSchema = z.object({
    type: z.enum(SCOPE_TYPES, invalid),
    targetIds: z
        .array(uuidSchema)
        .max(MAX_SCOPE_TARGETS, { error: 'errors.validation.maxItems' })
        .default([]),
})

export const CreateDiscountSchema = z.object({
    name: requiredText(120),
    kind: z.enum(DISCOUNT_KINDS, invalid),
    value: amountSchema,
    maxDiscountPerUnit: amountSchema.nullish(),
    scope: scopeSchema,
    startsAt: dateSchema.nullish(),
    endsAt: dateSchema.nullish(),
    isActive: z.boolean(invalid).optional(),
})
export type CreateDiscountBody = z.infer<typeof CreateDiscountSchema>

export const EditDiscountSchema = z
    .object({
        name: requiredText(120).optional(),
        kind: z.enum(DISCOUNT_KINDS, invalid).optional(),
        value: amountSchema.optional(),
        maxDiscountPerUnit: amountSchema.nullable().optional(),
        scope: scopeSchema.optional(),
        startsAt: dateSchema.nullable().optional(),
        endsAt: dateSchema.nullable().optional(),
        isActive: z.boolean(invalid).optional(),
    })
    .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' })
export type EditDiscountBody = z.infer<typeof EditDiscountSchema>

export const ListDiscountsQuerySchema = z.object({
    pageSize: pageSizeSchema.optional(),
    nextCursor: cursorSchema.optional(),
    sort: z
        .string()
        .max(100, invalid)
        .regex(/^[A-Za-z]+(:(asc|desc))?(,[A-Za-z]+(:(asc|desc))?)*$/, invalid)
        .optional(),
    isActive: z.enum(['true', 'false'], invalid).optional(),
})
export type ListDiscountsQuery = z.infer<typeof ListDiscountsQuerySchema>