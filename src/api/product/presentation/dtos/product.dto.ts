import { z } from 'zod'

import { MAX_PRODUCT_IMAGES, SHOE_GENDERS } from '@api/product/domain'
import { isNonEmptyBody, requiredText, slugSchema, uuidSchema } from '@common/validations'
import {normalizePersianLetters} from "@common/util";
import {CreateProductCommand, UpdateProductCommand} from "@api/product/application";

const invalid = { error: 'errors.validation.invalidFieldValue' }

const descriptionSchema = z
    .string({ error: 'errors.validation.requiredField' })
    .trim()
    .max(5000, { error: 'errors.validation.maxLengthString' })
    .overwrite(normalizePersianLetters)

const newShoeSchema = z.object({
    type: z.literal('shoe', invalid),
    name: requiredText(200),
    slug: slugSchema(220),
    description: descriptionSchema,
    categoryId: uuidSchema.nullish(),
    brandId: uuidSchema.nullish(),
    gender: z.enum(SHOE_GENDERS, invalid),
    material: requiredText(100).nullish(),
})

export const NewProductSchema = z.discriminatedUnion('type', [newShoeSchema])

export const CreateProductSchema = z.discriminatedUnion('type', [
    newShoeSchema.extend({ variantIds: z.array(uuidSchema).max(200, invalid).optional() }),
])  satisfies z.ZodType<CreateProductCommand>
export type CreateProductBody = z.infer<typeof CreateProductSchema>

export const UpdateProductSchema = z
    .object({
        name: requiredText(200).optional(),
        slug: slugSchema(220).optional(),
        description: descriptionSchema.optional(),
        categoryId: uuidSchema.nullable().optional(),
        brandId: uuidSchema.nullable().optional(),
        shoe: z
            .object({
                gender: z.enum(SHOE_GENDERS, invalid).optional(),
                material: requiredText(100).nullable().optional(),
            })
            .optional(),
    })
    .refine(isNonEmptyBody, { error: 'errors.validation.requiredRequestBody' }) satisfies z.ZodType<Omit<UpdateProductCommand, 'id'>>
export type UpdateProductBody = z.infer<typeof UpdateProductSchema>

export const UpdateGallerySchema = z.object({
    images: z
        .array(
            z.object({
                fileKey: z.string().trim().min(1, invalid).max(255, invalid),
                altText: requiredText(255).nullish(),
            }),
        )
        .max(MAX_PRODUCT_IMAGES, { error: 'errors.validation.maxItems' }),
})
export type UpdateGalleryBody = z.infer<typeof UpdateGallerySchema>