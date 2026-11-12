import { z } from 'zod'

import { PRODUCT_STATUSES, PRODUCT_TYPES } from '@api/product/domain'
import { normalizePersianLetters } from '@common/util'
import { cursorSchema, pageSizeSchema, uuidSchema } from '@common/validations'

const invalid = { error: 'errors.validation.invalidFieldValue' }

const sortSchema = z
    .string()
    .max(100, invalid)
    .regex(/^[A-Za-z]+(:(asc|desc))?(,[A-Za-z]+(:(asc|desc))?)*$/, invalid)

const priceSchema = z.coerce.number(invalid).int(invalid).min(0, invalid)

const booleanQuery = z.enum(['true', 'false'], invalid).transform((v) => v === 'true')

const attributesSchema = z
    .string()
    .max(500, invalid)
    .transform((raw) => {
        const result: Record<string, string[]> = {}
        for (const part of raw.split(';').slice(0, 10)) {
            const [name, values] = part.split(':')
            const list = (values ?? '').split(',').map((v) => v.trim()).filter(Boolean).slice(0, 20)
            if (name?.trim() && list.length) result[name.trim()] = list
        }
        return result
    })

export const ListProductsQuerySchema = z.object({
    pageSize: pageSizeSchema.optional(),
    sort: sortSchema.optional(),
    nextCursor: cursorSchema.optional(),
    type: z.enum(PRODUCT_TYPES, invalid).optional(),
    brandId: uuidSchema.optional(),
    categoryId: uuidSchema.optional(),
    minPrice: priceSchema.optional(),
    maxPrice: priceSchema.optional(),
    inStock: booleanQuery.optional(),
    attributes: attributesSchema.optional(),
})
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>

export const SearchProductsQuerySchema = ListProductsQuerySchema.extend({
    q: z
        .string({ error: 'errors.validation.requiredField' })
        .trim()
        .min(2, { error: 'errors.validation.minLengthString' })
        .max(100, { error: 'errors.validation.maxLengthString' })
        .overwrite(normalizePersianLetters),
})
export type SearchProductsQuery = z.infer<typeof SearchProductsQuerySchema>

export const CatalogFiltersQuerySchema = z.object({ categoryId: uuidSchema.optional() })
export type CatalogFiltersQuery = z.infer<typeof CatalogFiltersQuerySchema>

export const AdminListProductsQuerySchema = ListProductsQuerySchema.extend({
    q: z.string().trim().min(1, invalid).max(100, invalid).overwrite(normalizePersianLetters).optional(),    statuses: z
        .string()
        .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
        .pipe(z.array(z.enum(PRODUCT_STATUSES, invalid)).max(PRODUCT_STATUSES.length, invalid))
        .optional(),
})
export type AdminListProductsQuery = z.infer<typeof AdminListProductsQuerySchema>