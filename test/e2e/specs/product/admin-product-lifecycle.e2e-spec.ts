import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    VariantSeed,
    anonymousApi,
    createCategory,
    createProduct,
    createPublishedProduct,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    getAdminProduct,
    publishProduct,
    randomId,
    seedVariants,
    setGallery,
    sleep,
    slug,
    upsertUseCase,
} from './product-test.util'

describe('Admin products: publish / unpublish / archive (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
        anonymous = anonymousApi(ctx.app)
    })

    /** A draft that has everything publishing requires, unless a piece is switched off. */
    const readyDraft = async (
        options: { category?: boolean; images?: number; variants?: VariantSeed[] } = {},
    ) => {
        const {category = true, images = 1, variants = [{}]} = options
        const categoryId = category ? (await createCategory(admin)).id : undefined
        const seeded = variants.length ? await seedVariants(ctx.app, variants) : null
        const product = await createProduct(admin, {
            ...(categoryId ? {categoryId} : {}),
            variantIds: seeded?.variants.map((v) => v.id) ?? [],
        })
        if (images > 0) await setGallery(admin, product.id, images)
        return {id: product.id as string, slug: product.slug as string, categoryId, seeded}
    }

    const publicStatus = async (id: string, productSlug: string) => ({
        byId: (await anonymous.get(`/products/${id}`)).statusCode,
        bySlug: (await anonymous.get(`/products/slug/${productSlug}`)).statusCode,
    })

    describe('POST /admin/products/:id/publish', () => {
        it('publishes a complete draft and exposes it publicly', async () => {
            const {id, slug: productSlug} = await readyDraft()
            expect(await publicStatus(id, productSlug)).toEqual({byId: 404, bySlug: 404})

            const res = await admin.post(`/admin/products/${id}/publish`)

            expectOk(res, 200, 'PRODUCT_PUBLISH_SUCCESS')
            expect(res.json().data).toMatchObject({id, status: 'published', publishedAt: expect.any(String)})
            expect(await publicStatus(id, productSlug)).toEqual({byId: 200, bySlug: 200})
        })

        it.each([
            ['category', {category: false}],
            ['image', {images: 0}],
            ['active variant (none attached)', {variants: []}],
            ['active variant (only inactive attached)', {variants: [{isActive: false}]}],
        ])('refuses to publish without a %s', async (_label, options) => {
            const {id} = await readyDraft(options as any)

            expectError(await admin.post(`/admin/products/${id}/publish`), 400, 'PRODUCT_NOT_PUBLISHABLE')
            expect((await getAdminProduct(admin, id)).status).toBe('draft')
        })

        it('refuses to publish a product that lacks everything', async () => {
            const bare = await createProduct(admin)

            expectError(await admin.post(`/admin/products/${bare.id}/publish`), 400, 'PRODUCT_NOT_PUBLISHABLE')
        })

        it('re-validates attributes of active variants that changed after they were attached', async () => {
            const {id, seeded} = await readyDraft()
            const item = seeded!.items[0]
            await upsertUseCase(ctx.app).execute({
                source: seeded!.source,
                items: [
                    {
                        ...item,
                        attributes: [
                            {name: 'size', value: '99'},
                            {name: 'color', value: 'black'},
                        ],
                    },
                ],
            })

            expectError(await admin.post(`/admin/products/${id}/publish`), 400, 'VARIANT_INVALID_ATTRIBUTES')
            expect((await getAdminProduct(admin, id)).status).toBe('draft')
        })

        it('keeps the original publishedAt across unpublish/publish cycles', async () => {
            const {id} = await readyDraft()
            const first = await publishProduct(admin, id)
            expect(first.publishedAt).not.toBeNull()

            const unpublished = await admin.post(`/admin/products/${id}/unpublish`)
            expect(unpublished.json().data.publishedAt).toBe(first.publishedAt)

            await sleep(15)
            const again = await publishProduct(admin, id)
            expect(again.publishedAt).toBe(first.publishedAt)
        })

        it('returns 404 for an unknown product and 400 for a malformed id', async () => {
            expectError(await admin.post(`/admin/products/${randomId()}/publish`), 404, 'PRODUCT_NOT_FOUND')
            expectValidationError(await admin.post('/admin/products/not-a-uuid/publish'))
        })
    })

    describe('status transitions', () => {
        type State = 'draft' | 'published' | 'archived'
        type Action = 'publish' | 'unpublish' | 'archive'

        const inState = async (state: State) => {
            const {id, slug: productSlug} = await readyDraft()
            if (state === 'published') await publishProduct(admin, id)
            if (state === 'archived') expect((await admin.post(`/admin/products/${id}/archive`)).statusCode).toBe(200)
            return {id, slug: productSlug}
        }

        const matrix: [State, Action, State | 'conflict'][] = [
            ['draft', 'publish', 'published'],
            ['draft', 'unpublish', 'conflict'],
            ['draft', 'archive', 'archived'],
            ['published', 'publish', 'conflict'],
            ['published', 'unpublish', 'draft'],
            ['published', 'archive', 'archived'],
            ['archived', 'publish', 'conflict'],
            ['archived', 'unpublish', 'draft'],
            ['archived', 'archive', 'conflict'],
        ]

        it.each(matrix)('%s + %s -> %s', async (from, action, expected) => {
            const {id} = await inState(from)

            const res = await admin.post(`/admin/products/${id}/${action}`)

            if (expected === 'conflict') {
                expectError(res, 409, 'PRODUCT_INVALID_STATUS_TRANSITION')
                expect((await getAdminProduct(admin, id)).status).toBe(from)
            } else {
                expect(res.statusCode).toBe(200)
                expect(res.json().code).toBe(`PRODUCT_${action.toUpperCase()}_SUCCESS`)
                expect(res.json().data.status).toBe(expected)
                expect((await getAdminProduct(admin, id)).status).toBe(expected)
            }
        })

        it('hides a product from the public API after unpublish and after archive', async () => {
            const unpublished = await inState('published')
            expect(await publicStatus(unpublished.id, unpublished.slug)).toEqual({byId: 200, bySlug: 200})
            await admin.post(`/admin/products/${unpublished.id}/unpublish`)
            expect(await publicStatus(unpublished.id, unpublished.slug)).toEqual({byId: 404, bySlug: 404})

            const archived = await inState('published')
            await admin.post(`/admin/products/${archived.id}/archive`)
            expect(await publicStatus(archived.id, archived.slug)).toEqual({byId: 404, bySlug: 404})
        })

        it('lets an archived product return to draft and be published again', async () => {
            const {id, slug: productSlug} = await inState('archived')

            expect((await admin.post(`/admin/products/${id}/unpublish`)).json().data.status).toBe('draft')
            expect((await admin.post(`/admin/products/${id}/publish`)).json().data.status).toBe('published')
            expect(await publicStatus(id, productSlug)).toEqual({byId: 200, bySlug: 200})
        })

        it('unpublish and archive return 404 for unknown products and 400 for malformed ids', async () => {
            for (const action of ['unpublish', 'archive']) {
                expectError(await admin.post(`/admin/products/${randomId()}/${action}`), 404, 'PRODUCT_NOT_FOUND')
                expectValidationError(await admin.post(`/admin/products/not-a-uuid/${action}`))
            }
        })
    })

    describe('published product edit rules', () => {
        it('locks the slug once the product was published, even after unpublishing', async () => {
            const product = await createPublishedProduct(ctx.app, admin)

            expectError(
                await admin.patch(`/admin/products/${product.id}`, {slug: slug('other')}),
                409,
                'PRODUCT_SLUG_LOCKED',
            )

            await admin.post(`/admin/products/${product.id}/unpublish`)
            expectError(
                await admin.patch(`/admin/products/${product.id}`, {slug: slug('other')}),
                409,
                'PRODUCT_SLUG_LOCKED',
            )

            // re-sending the current slug is not a change
            expect((await admin.patch(`/admin/products/${product.id}`, {slug: product.slug})).statusCode).toBe(200)
            expect((await getAdminProduct(admin, product.id)).slug).toBe(product.slug)
        })

        it('still allows editing name, description and brand of a published product', async () => {
            const product = await createPublishedProduct(ctx.app, admin)

            const res = await admin.patch(`/admin/products/${product.id}`, {
                name: 'Edited while published',
                description: 'Edited description',
                brandId: null,
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data).toMatchObject({status: 'published', name: 'Edited while published'})
        })

        it('refuses to remove the category of a published product', async () => {
            const product = await createPublishedProduct(ctx.app, admin)

            const res = await admin.patch(`/admin/products/${product.id}`, {categoryId: null})

            expectError(res, 400, 'PRODUCT_NOT_PUBLISHABLE')
            expect((await getAdminProduct(admin, product.id)).categoryId).toBe(product.categoryId)
        })

        it('allows changing the category of a published product to another existing one', async () => {
            const product = await createPublishedProduct(ctx.app, admin)
            const other = await createCategory(admin)

            const res = await admin.patch(`/admin/products/${product.id}`, {categoryId: other.id})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.categoryId).toBe(other.id)
        })
    })
})
