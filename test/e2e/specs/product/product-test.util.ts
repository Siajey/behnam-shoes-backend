import {randomUUID} from 'node:crypto'

import {NestFastifyApplication} from '@nestjs/platform-fastify'
import {expect} from '@jest/globals'

import {
    ExternalVariantInput,
    IDeactivateMissingVariants,
    IGetVariantsByIds,
    IUpsertVariantsFromExternal,
} from '@api/product/application'
import {IVariantRepository} from '@api/product/domain'
import {UserRole, UserStatus} from '@api/users/domain'
import {
    DEACTIVATE_MISSING_VARIANTS,
    GET_VARIANTS_BY_IDS,
    UPSERT_VARIANTS_FROM_EXTERNAL,
    VARIANT_REPOSITORY,
} from '@common/di'

import {TestContext} from '../test-context.e2e'
import {createUser, loginWithOtp, newPhone} from '../../../util/test.util'

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export const uid = () => randomUUID().replace(/-/g, '').slice(0, 8)
export const slug = (prefix: string) => `${prefix}-${uid()}`
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const randomId = () => randomUUID()

export const omit = <T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> => {
    const copy = {...obj}
    delete copy[key]
    return copy
}

export const idsOf = (items: { id: string }[]) => items.map((i) => i.id)

/** Arabic kaf/yeh variants that the API must normalise to Persian kaf/yeh. */
export const AR_NAME = '\u0643\u0641\u0634 \u0648\u0631\u0632\u0634\u064A' // كفش ورزشي
export const FA_NAME = '\u06A9\u0641\u0634 \u0648\u0631\u0632\u0634\u06CC' // کفش ورزشی
export const FA_SLUG = '\u06A9\u0641\u0634-\u0648\u0631\u0632\u0634\u06CC' // کفش-ورزشی
export const AR_SLUG = '\u0643\u0641\u0634-\u0648\u0631\u0632\u0634\u064A' // arabic variant of FA_SLUG
export const PERSIAN_FORTY_TWO = '\u06F4\u06F2' // ۴۲
export const PERSIAN_FORTY = '\u06F4\u06F0' // ۴۰

export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) search.set(key, String(value))
    }
    const out = search.toString()
    return out ? `?${out}` : ''
}

type Res = { statusCode: number; json: () => any }

export const expectOk = (res: Res, status: number, code: string) => {
    expect(res.statusCode).toBe(status)
    expect(res.json().code).toBe(code)
}

export const expectError = (res: Res, status: number, code: string) => {
    expect(res.statusCode).toBe(status)
    expect(res.json().code).toBe(code)
}

export const expectValidationError = (res: Res) => expectError(res, 400, 'VALIDATION_ERROR')

/** Maps an `options` array to {name: sortedValues} so assertions do not depend on DB ordering. */
export const optionMap = (options: { name: string; values: string[] }[]) =>
    Object.fromEntries(options.map((o) => [o.name, [...o.values].sort()]))

/* ------------------------------------------------------------------ */
/* Sessions + HTTP wrapper                                             */
/* ------------------------------------------------------------------ */

export interface Session {
    cookies: Record<string, string>
    csrfToken: string
}

export const createSession = async (ctx: TestContext, role: UserRole): Promise<Session> => {
    const user = await createUser(ctx.userRepository, {
        phoneNumber: newPhone(),
        role,
        status: UserStatus.ACTIVE,
    })
    const {cookies, csrfToken} = await loginWithOtp(ctx.app, user)
    return {cookies, csrfToken}
}

export type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export class Api {
    constructor(
        private readonly app: NestFastifyApplication,
        private readonly session?: Session,
        private readonly sendCsrf = true,
    ) {
    }

    request(method: Method, url: string, payload?: unknown) {
        return this.app.inject({
            method,
            url,
            cookies: this.session?.cookies,
            headers: this.session && this.sendCsrf ? {'x-csrf-token': this.session.csrfToken} : undefined,
            payload: payload as any,
        })
    }

    get = (url: string) => this.request('GET', url)
    post = (url: string, payload?: unknown) => this.request('POST', url, payload ?? {})
    patch = (url: string, payload?: unknown) => this.request('PATCH', url, payload ?? {})
    put = (url: string, payload?: unknown) => this.request('PUT', url, payload ?? {})
    delete = (url: string) => this.request('DELETE', url)
}

export const anonymousApi = (app: NestFastifyApplication) => new Api(app)
export const apiWithoutCsrf = (app: NestFastifyApplication, session: Session) => new Api(app, session, false)

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

/** Follows `nextCursor` until it is falsy and returns every page's `data`. */
export const walkPages = async (api: Api, path: string, params: Record<string, any> = {}, maxPages = 50) => {
    const pages: any[] = []
    let nextCursor: string | undefined
    for (let i = 0; i < maxPages; i++) {
        const res = await api.get(`${path}${qs({...params, nextCursor})}`)
        expect(res.statusCode).toBe(200)
        const data = res.json().data
        pages.push(data)
        if (!data.nextCursor) return pages
        nextCursor = data.nextCursor
    }
    throw new Error('cursor never terminated')
}

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
