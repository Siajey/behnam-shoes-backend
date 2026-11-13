import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

import {
    ExternalVariantInput,
    IDeactivateMissingVariants,
    IGetVariantsByIds,
    IUpsertVariantsFromExternal,
} from '@api/product/application'
import {IVariantRepository} from '@api/product/domain'
import {
    DEACTIVATE_MISSING_VARIANTS,
    GET_VARIANTS_BY_IDS,
    UPSERT_VARIANTS_FROM_EXTERNAL,
    VARIANT_REPOSITORY,
} from '@common/di'

import {Api, slug, uid} from '../../../util/test.util'

/** Maps an `options` array to {name: sortedValues} so assertions do not depend on DB ordering. */
export const optionMap = (options: { name: string; values: string[] }[]) =>
    Object.fromEntries(options.map((o) => [o.name, [...o.values].sort()]))

/* ------------------------------------------------------------------ */
/* Variant seeding (variants come from accounting, so there is no      */
/* endpoint: we go through the system use cases exported by the module) */
/* ------------------------------------------------------------------ */

export const upsertUseCase = (app: NestFastifyApplication) =>
    app.get<IUpsertVariantsFromExternal>(UPSERT_VARIANTS_FROM_EXTERNAL, {strict: false})

export const deactivateUseCase = (app: NestFastifyApplication) =>
    app.get<IDeactivateMissingVariants>(DEACTIVATE_MISSING_VARIANTS, {strict: false})

export const getVariantsByIdsUseCase = (app: NestFastifyApplication) =>
    app.get<IGetVariantsByIds>(GET_VARIANTS_BY_IDS, {strict: false})

export const variantRepository = (app: NestFastifyApplication) =>
    app.get<IVariantRepository>(VARIANT_REPOSITORY, {strict: false})

export interface VariantSeed {
    size?: string
    color?: string
    price?: number
    stock?: number
    isActive?: boolean
    /** Overrides size/color completely (e.g. to create invalid variants). */
    attributes?: { name: string; value: string }[]
}

export interface SeededVariant {
    id: string
    externalId: string
    sku: string
    source: string
}

export const newSource = () => `src-${uid()}`

export const variantItem = (seed: VariantSeed, index: number, tag: string): ExternalVariantInput => ({
    externalId: `ext-${tag}-${index}`,
    title: `Variant ${tag}-${index}`,
    sku: `sku-${tag}-${index}`,
    price: seed.price ?? 1000,
    stock: seed.stock ?? 5,
    isActive: seed.isActive ?? true,
    attributes: seed.attributes ?? [
        {name: 'size', value: seed.size ?? '42'},
        {name: 'color', value: seed.color ?? 'black'},
    ],
})

export const seedVariants = async (
    app: NestFastifyApplication,
    seeds: VariantSeed[],
    source: string = newSource(),
) => {
    const tag = uid()
    const items = seeds.map((seed, index) => variantItem(seed, index, tag))
    const result = await upsertUseCase(app).execute({source, items})

    const stored = await variantRepository(app).findByExternalIds(
        source,
        items.map((i) => i.externalId),
    )
    const byExternalId = new Map(stored.map((v) => [v.externalId, v]))

    const variants: SeededVariant[] = items.map((item) => {
        const variant = byExternalId.get(item.externalId)
        if (!variant) throw new Error(`variant ${item.externalId} was not stored (rejected?)`)
        return {id: variant.id, externalId: variant.externalId, sku: variant.sku, source}
    })

    return {source, items, result, variants}
}

/* ------------------------------------------------------------------ */
/* Domain object factories (through the real HTTP API)                 */
/* ------------------------------------------------------------------ */

export const createBrand = async (admin: Api, overrides: Record<string, unknown> = {}) => {
    const res = await admin.post('/admin/brands', {
        name: `Brand ${uid()}`,
        slug: slug('brand'),
        ...overrides,
    })
    expect(res.statusCode).toBe(201)
    return res.json().data
}

export const createCategory = async (admin: Api, overrides: Record<string, unknown> = {}) => {
    const res = await admin.post('/admin/categories', {
        name: `Category ${uid()}`,
        slug: slug('category'),
        ...overrides,
    })
    expect(res.statusCode).toBe(201)
    return res.json().data
}

export const shoeBody = (overrides: Record<string, unknown> = {}) => ({
    type: 'shoe',
    name: `Shoe ${uid()}`,
    slug: slug('shoe'),
    description: 'A comfortable shoe',
    gender: 'unisex',
    ...overrides,
})

export const createProduct = async (admin: Api, overrides: Record<string, unknown> = {}) => {
    const res = await admin.post('/admin/products', shoeBody(overrides))
    expect(res.statusCode).toBe(201)
    return res.json().data
}

export const galleryImages = (productId: string, count: number) =>
    Array.from({length: count}, (_, i) => ({
        fileKey: `products/${productId}/img-${i}.webp`,
        altText: `image ${i}`,
    }))

export const setGallery = async (admin: Api, productId: string, count = 1) => {
    const res = await admin.put(`/admin/products/${productId}/gallery`, {
        images: galleryImages(productId, count),
    })
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const publishProduct = async (admin: Api, productId: string) => {
    const res = await admin.post(`/admin/products/${productId}/publish`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const getAdminProduct = async (admin: Api, productId: string) => {
    const res = await admin.get(`/admin/products/${productId}`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export interface PublishedProductOptions {
    name?: string
    slug?: string
    categoryId?: string
    brandId?: string | null
    gender?: 'men' | 'women' | 'unisex' | 'kids'
    material?: string | null
    description?: string
    variants?: VariantSeed[]
    images?: number
}

/** Creates seeded variants + a product that has everything required to be published, then publishes it. */
export const createPublishedProduct = async (
    app: NestFastifyApplication,
    admin: Api,
    options: PublishedProductOptions = {},
) => {
    const categoryId = options.categoryId ?? (await createCategory(admin)).id
    const {variants, source} = await seedVariants(app, options.variants ?? [{}])

    const created = await createProduct(admin, {
        ...(options.name ? {name: options.name} : {}),
        ...(options.slug ? {slug: options.slug} : {}),
        ...(options.description ? {description: options.description} : {}),
        ...(options.gender ? {gender: options.gender} : {}),
        ...(options.material !== undefined ? {material: options.material} : {}),
        categoryId,
        brandId: options.brandId ?? null,
        variantIds: variants.map((v) => v.id),
    })

    await setGallery(admin, created.id, options.images ?? 1)
    const published = await publishProduct(admin, created.id)

    return {
        id: created.id as string,
        slug: created.slug as string,
        name: created.name as string,
        categoryId,
        variantIds: variants.map((v) => v.id),
        variants,
        source,
        data: published,
    }
}

/** A draft product with variants attached (not publishable yet: no gallery, no category). */
export const createDraftProduct = async (
    app: NestFastifyApplication,
    admin: Api,
    seeds: VariantSeed[] = [{}],
    overrides: Record<string, unknown> = {},
) => {
    const {variants, source} = await seedVariants(app, seeds)
    const product = await createProduct(admin, {
        ...overrides,
        variantIds: variants.map((v) => v.id),
    })
    return {id: product.id as string, slug: product.slug as string, variants, source, data: product}
}

export const unpublishProduct = async (admin: Api, productId: string) => {
    const res = await admin.post(`/admin/products/${productId}/unpublish`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

export const archiveProduct = async (admin: Api, productId: string) => {
    const res = await admin.post(`/admin/products/${productId}/archive`)
    expect(res.statusCode).toBe(200)
    return res.json().data
}

/** File key of the n-th image created by `setGallery` / `createPublishedProduct`. */
export const imageKeyOf = (productId: string, index = 0) => `products/${productId}/img-${index}.webp`

/**
 * Re-sends one variant through the accounting sync (upsert) with some fields changed, the way a
 * price/stock/activation change reaches the shop. Fields that are not given keep their current value.
 */
export const changeVariant = async (
    app: NestFastifyApplication,
    variant: SeededVariant,
    changes: {
        price?: number
        stock?: number
        isActive?: boolean
        title?: string
        attributes?: { name: string; value: string }[]
    },
) => {
    const [current] = await variantRepository(app).findByExternalIds(variant.source, [variant.externalId])
    if (!current) throw new Error(`variant ${variant.externalId} not found`)

    return upsertUseCase(app).execute({
        source: variant.source,
        items: [
            {
                externalId: current.externalId,
                title: changes.title ?? current.title,
                sku: current.sku,
                price: changes.price ?? current.price,
                stock: changes.stock ?? current.stock,
                isActive: changes.isActive ?? current.isActive,
                attributes: changes.attributes ?? current.attributes.map((a) => ({name: a.name, value: a.value})),
            },
        ],
    })
}
