import { z } from 'zod'

import { isNonEmptyBody, requiredText, slugSchema, uuidSchema } from '@common/validations'
import {CreateBrandInput, CreateCategoryInput, EditBrandInput, EditCategoryInput} from "@api/product/application";

const invalid = { error: 'errors.validation.invalidFieldValue' }
const sortOrder = z.coerce.number(invalid).int(invalid).min(0, invalid).max(10_000, invalid)
const emptyBody = { error: 'errors.validation.requiredRequestBody' }

export const CreateCategorySchema = z.object({
    name: requiredText(120),
    slug: slugSchema(150),
    parentId: uuidSchema.nullish(),
    sortOrder: sortOrder.optional(),
}) satisfies z.ZodType<CreateCategoryInput>
export type CreateCategoryBody = z.infer<typeof CreateCategorySchema>

export const EditCategorySchema = z
    .object({
        name: requiredText(120).optional(),
        slug: slugSchema(150).optional(),
        parentId: uuidSchema.nullable().optional(),
        sortOrder: sortOrder.optional(),
    })
    .refine(isNonEmptyBody, emptyBody) satisfies z.ZodType<Omit<EditCategoryInput, 'id'>>
export type EditCategoryBody = z.infer<typeof EditCategorySchema>

export const CreateBrandSchema = z.object({
    name: requiredText(120),
    slug: slugSchema(150),
    logoKey: z.string().trim().min(1, invalid).max(255, invalid).nullish(),
}) satisfies z.ZodType<CreateBrandInput>
export type CreateBrandBody = z.infer<typeof CreateBrandSchema>

export const EditBrandSchema = z
    .object({
        name: requiredText(120).optional(),
        slug: slugSchema(150).optional(),
        logoKey: z.string().trim().min(1, invalid).max(255, invalid).nullable().optional(),
    })
    .refine(isNonEmptyBody, emptyBody)  satisfies z.ZodType<Omit<EditBrandInput, 'id'>>
export type EditBrandBody = z.infer<typeof EditBrandSchema>