import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    anonymousApi,
    Api,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    idsOf,
    qs,
    randomId,
    sleep,
    walkPages,
} from '../../../util/test.util'
import {
    createBrand,
    createCategory,
    createDraftProduct,
    createProduct,
    createPublishedProduct,
    getAdminProduct,
    seedVariants,
    shoeBody,
    upsertUseCase,
} from './product-test.util'

describe('Admin variants (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
        anonymous = anonymousApi(ctx.app)
    })

    const sorted = (values: string[]) => [...values].sort()
    const variantIdsOf = (detail: { variants: { id: string }[] }) => sorted(idsOf(detail.variants))
    const unassignedIds = async () =>
        (await walkPages(admin, '/admin/variants/unassigned', {pageSize: 100})).flatMap((p) => idsOf(p.items))

    const breakVariant = async (seeded: Awaited<ReturnType<typeof seedVariants>>, index = 0) => {
        await upsertUseCase(ctx.app).execute({
            source: seeded.source,
            items: [
                {
                    ...seeded.items[index],
                    attributes: [
                        {name: 'size', value: '99'},
                        {name: 'color', value: 'black'},
                    ],
                },
            ],
        })
    }

    const newShoe = (overrides: Record<string, unknown> = {}) => {
        const {type, name, slug: newSlug, description, gender} = shoeBody()
        return {type, name, slug: newSlug, description, gender, ...overrides}
    }

    describe('GET /admin/variants/unassigned', () => {
        it('lists unassigned variants with the admin shape', async () => {
            const {variants, items} = await seedVariants(ctx.app, [{size: '39', color: 'green', price: 321, stock: 7}])

            const res = await admin.get('/admin/variants/unassigned?pageSize=100')

            expectOk(res, 200, 'VARIANT_UNASSIGNED_LIST_SUCCESS')
            const found = (res.json().data.items as any[]).find((v) => v.id === variants[0].id)
            expect(found).toEqual({
                id: variants[0].id,
                productId: null,
                source: variants[0].source,
                externalId: items[0].externalId,
                sku: items[0].sku,
                title: items[0].title,
                price: 321,
                stock: 7,
                isActive: true,
                attributes: expect.arrayContaining([
                    {name: 'size', value: '39'},
                    {name: 'color', value: 'green'},
                ]),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
        })

        it('includes inactive variants and excludes variants that belong to a product', async () => {
            const {variants: free} = await seedVariants(ctx.app, [{isActive: false}])
            const draft = await createDraftProduct(ctx.app, admin, [{}])

            const ids = await unassignedIds()

            expect(ids).toContain(free[0].id)
            expect(ids).not.toContain(draft.variants[0].id)
        })

        it('orders by newest first', async () => {
            const older = await seedVariants(ctx.app, [{}])
            await sleep(15)
            const newer = await seedVariants(ctx.app, [{}])

            const ids = await unassignedIds()

            expect(ids.indexOf(newer.variants[0].id)).toBeLessThan(ids.indexOf(older.variants[0].id))
        })

        it('walks all pages with pageSize=2 without gaps or duplicates', async () => {
            await seedVariants(ctx.app, [{}, {}, {}])
            const everything = await unassignedIds()

            const pages = await walkPages(admin, '/admin/variants/unassigned', {pageSize: 2})

            const walked = pages.flatMap((p) => idsOf(p.items))
            expect(walked).toEqual(everything)
            expect(new Set(walked).size).toBe(walked.length)
            expect(pages[pages.length - 1].nextCursor).toBeNull()
        })

        it('returns the first page for a malformed cursor and rejects invalid paging values', async () => {
            const res = await admin.get(`/admin/variants/unassigned${qs({nextCursor: 'garbage', pageSize: 100})}`)
            expect(res.statusCode).toBe(200)

            expectValidationError(await admin.get('/admin/variants/unassigned?pageSize=0'))
            expectValidationError(await admin.get('/admin/variants/unassigned?pageSize=101'))
            expectValidationError(await admin.get(`/admin/variants/unassigned${qs({nextCursor: 'x'.repeat(513)})}`))
        })
    })

    describe('POST /admin/products/:id/variants (attach)', () => {
        it('attaches unassigned variants and returns the product with all of its variants', async () => {
            const product = await createDraftProduct(ctx.app, admin, [{size: '40'}])
            const extra = await seedVariants(ctx.app, [{size: '41'}, {size: '42'}])

            const res = await admin.post(`/admin/products/${product.id}/variants`, {
                variantIds: extra.variants.map((v) => v.id),
            })

            expectOk(res, 200, 'VARIANT_ATTACH_SUCCESS')
            expect(res.json().data.id).toBe(product.id)
            expect(variantIdsOf(res.json().data)).toEqual(
                sorted([product.variants[0].id, ...extra.variants.map((v) => v.id)]),
            )
            res.json().data.variants.forEach((v: any) => expect(v.productId).toBe(product.id))

            const stored = await getAdminProduct(admin, product.id)
            expect(stored.variants).toHaveLength(3)
            const free = await unassignedIds()
            extra.variants.forEach((v) => expect(free).not.toContain(v.id))
        })

        it('attaches to a product that has no variants yet', async () => {
            const product = await createProduct(admin)
            const {variants} = await seedVariants(ctx.app, [{}])

            const res = await admin.post(`/admin/products/${product.id}/variants`, {variantIds: [variants[0].id]})

            expect(res.statusCode).toBe(200)
            expect(variantIdsOf(res.json().data)).toEqual([variants[0].id])
        })

        it('keeps a published product published and exposes the new variant publicly', async () => {
            const published = await createPublishedProduct(ctx.app, admin, {variants: [{size: '40', price: 1000}]})
            const extra = await seedVariants(ctx.app, [{size: '41', price: 2000, stock: 3}])

            const res = await admin.post(`/admin/products/${published.id}/variants`, {
                variantIds: [extra.variants[0].id],
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data.status).toBe('published')
            const publicDetail = (await anonymous.get(`/products/${published.id}`)).json().data
            expect(publicDetail.variants).toHaveLength(2)
            expect(publicDetail.maxPrice).toBe(2000)
        })

        it('ignores duplicate ids in the request', async () => {
            const product = await createProduct(admin)
            const {variants} = await seedVariants(ctx.app, [{}])

            const res = await admin.post(`/admin/products/${product.id}/variants`, {
                variantIds: [variants[0].id, variants[0].id],
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data.variants).toHaveLength(1)
        })

        it('returns 404 for an unknown variant', async () => {
            const product = await createProduct(admin)

            expectError(
                await admin.post(`/admin/products/${product.id}/variants`, {variantIds: [randomId()]}),
                404,
                'VARIANT_NOT_FOUND',
            )
        })

        it('returns 409 when a variant is already assigned (to another product or to the same one)', async () => {
            const owner = await createDraftProduct(ctx.app, admin, [{}])
            const product = await createProduct(admin)

            expectError(
                await admin.post(`/admin/products/${product.id}/variants`, {variantIds: [owner.variants[0].id]}),
                409,
                'VARIANT_ALREADY_ASSIGNED',
            )
            expectError(
                await admin.post(`/admin/products/${owner.id}/variants`, {variantIds: [owner.variants[0].id]}),
                409,
                'VARIANT_ALREADY_ASSIGNED',
            )
        })

        it('returns 409 for an archived product', async () => {
            const product = await createProduct(admin)
            await admin.post(`/admin/products/${product.id}/archive`)
            const {variants} = await seedVariants(ctx.app, [{}])

            expectError(
                await admin.post(`/admin/products/${product.id}/variants`, {variantIds: [variants[0].id]}),
                409,
                'PRODUCT_ARCHIVED',
            )
        })

        it('rejects variants whose attributes break the shoe rules, attaching none of them', async () => {
            const product = await createProduct(admin)
            const valid = await seedVariants(ctx.app, [{size: '42'}])
            const invalid = await seedVariants(ctx.app, [{size: '99'}])
            const missingColor = await seedVariants(ctx.app, [{attributes: [{name: 'size', value: '42'}]}])

            expectError(
                await admin.post(`/admin/products/${product.id}/variants`, {
                    variantIds: [valid.variants[0].id, invalid.variants[0].id],
                }),
                400,
                'VARIANT_INVALID_ATTRIBUTES',
            )
            expectError(
                await admin.post(`/admin/products/${product.id}/variants`, {
                    variantIds: [missingColor.variants[0].id],
                }),
                400,
                'VARIANT_INVALID_ATTRIBUTES',
            )

            expect((await getAdminProduct(admin, product.id)).variants).toEqual([])
            expect(await unassignedIds()).toContain(valid.variants[0].id)
        })

        it('returns 404 for an unknown product', async () => {
            const {variants} = await seedVariants(ctx.app, [{}])

            expectError(
                await admin.post(`/admin/products/${randomId()}/variants`, {variantIds: [variants[0].id]}),
                404,
                'PRODUCT_NOT_FOUND',
            )
        })

        it.each([
            ['an empty list', {variantIds: []}],
            ['a missing list', {}],
            ['a non-array', {variantIds: 'abc'}],
            ['a malformed uuid', {variantIds: ['nope']}],
            ['more than 200 ids', {variantIds: Array.from({length: 201}, () => randomId())}],
        ])('rejects %s', async (_label, body) => {
            const product = await createProduct(admin)

            expectValidationError(await admin.post(`/admin/products/${product.id}/variants`, body))
        })

        it('returns 400 for a malformed product id', async () => {
            expectValidationError(await admin.post('/admin/products/not-a-uuid/variants', {variantIds: [randomId()]}))
        })
    })

    describe('POST /admin/products/:id/variants/move', () => {
        it('moves variants between draft products', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{size: '40'}, {size: '41'}])
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [source.variants[0].id],
            })

            expectOk(res, 200, 'VARIANT_MOVE_SUCCESS')
            expect(res.json().data.unpublishedProductIds).toEqual([])
            expect(res.json().data.target.id).toBe(target.id)
            expect(variantIdsOf(res.json().data.target)).toEqual(
                sorted([source.variants[0].id, target.variants[0].id]),
            )
            expect(variantIdsOf(await getAdminProduct(admin, source.id))).toEqual([source.variants[1].id])
            expect((await getAdminProduct(admin, source.id)).status).toBe('draft')
        })

        it('moves an unassigned variant into a product', async () => {
            const target = await createDraftProduct(ctx.app, admin, [{}])
            const free = await seedVariants(ctx.app, [{size: '43'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [free.variants[0].id],
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data.unpublishedProductIds).toEqual([])
            expect(variantIdsOf(res.json().data.target)).toContain(free.variants[0].id)
            expect(await unassignedIds()).not.toContain(free.variants[0].id)
        })

        it('unpublishes a published source that loses its last active variant', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {variants: [{}]})
            const target = await createDraftProduct(ctx.app, admin, [{size: '44'}])
            expect((await anonymous.get(`/products/${source.id}`)).statusCode).toBe(200)

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [source.variantIds[0]],
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data.unpublishedProductIds).toEqual([source.id])
            const stored = await getAdminProduct(admin, source.id)
            expect(stored.status).toBe('draft')
            expect(stored.variants).toEqual([])
            expect((await anonymous.get(`/products/${source.id}`)).statusCode).toBe(404)
        })

        it('keeps a published source published while it still has another active variant', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {variants: [{size: '40'}, {size: '41'}]})
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [source.variantIds[0]],
            })

            expect(res.json().data.unpublishedProductIds).toEqual([])
            expect((await getAdminProduct(admin, source.id)).status).toBe('published')
        })

        it('unpublishes a published source whose remaining variants are all inactive', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {
                variants: [{size: '40'}, {size: '41', isActive: false}],
            })
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [source.variantIds[0]],
            })

            expect(res.json().data.unpublishedProductIds).toEqual([source.id])
            expect((await getAdminProduct(admin, source.id)).status).toBe('draft')
        })

        it('does not report draft sources as unpublished even when they are emptied', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])
            const target = await createDraftProduct(ctx.app, admin, [{size: '45'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [source.variants[0].id],
            })

            expect(res.json().data.unpublishedProductIds).toEqual([])
            expect((await getAdminProduct(admin, source.id)).variants).toEqual([])
        })

        it('is a no-op for variants that already belong to the target', async () => {
            const target = await createDraftProduct(ctx.app, admin, [{size: '40'}, {size: '41'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [target.variants[0].id],
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data.unpublishedProductIds).toEqual([])
            expect(variantIdsOf(res.json().data.target)).toEqual(sorted(target.variants.map((v) => v.id)))
        })

        it('moves variants from several sources in one request', async () => {
            const a = await createDraftProduct(ctx.app, admin, [{size: '40'}])
            const b = await createPublishedProduct(ctx.app, admin, {variants: [{size: '41'}]})
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            const res = await admin.post(`/admin/products/${target.id}/variants/move`, {
                variantIds: [a.variants[0].id, b.variantIds[0]],
            })

            expect(res.json().data.unpublishedProductIds).toEqual([b.id])
            expect(res.json().data.target.variants).toHaveLength(3)
        })

        it('returns 404 when a variant does not exist and leaves everything untouched', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])
            const target = await createDraftProduct(ctx.app, admin, [{size: '43'}])

            expectError(
                await admin.post(`/admin/products/${target.id}/variants/move`, {
                    variantIds: [source.variants[0].id, randomId()],
                }),
                404,
                'VARIANT_NOT_FOUND',
            )
            expect((await getAdminProduct(admin, source.id)).variants).toHaveLength(1)
        })

        it('returns 404 for an unknown target', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])

            expectError(
                await admin.post(`/admin/products/${randomId()}/variants/move`, {
                    variantIds: [source.variants[0].id],
                }),
                404,
                'PRODUCT_NOT_FOUND',
            )
        })

        it('returns 409 when the target is archived', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])
            const target = await createProduct(admin)
            await admin.post(`/admin/products/${target.id}/archive`)

            expectError(
                await admin.post(`/admin/products/${target.id}/variants/move`, {
                    variantIds: [source.variants[0].id],
                }),
                409,
                'PRODUCT_ARCHIVED',
            )
            expect((await getAdminProduct(admin, source.id)).variants).toHaveLength(1)
        })

        it('returns 400 when a moved variant breaks the shoe rules and moves nothing', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{size: '40'}, {size: '41'}])
            const broken = await seedVariants(ctx.app, [{size: '99'}])
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            expectError(
                await admin.post(`/admin/products/${target.id}/variants/move`, {
                    variantIds: [source.variants[0].id, broken.variants[0].id],
                }),
                400,
                'VARIANT_INVALID_ATTRIBUTES',
            )
            expect((await getAdminProduct(admin, source.id)).variants).toHaveLength(2)
            expect(variantIdsOf(await getAdminProduct(admin, target.id))).toEqual(
                sorted(target.variants.map((v) => v.id)),
            )
        })

        it.each([
            ['an empty list', {variantIds: []}],
            ['a missing list', {}],
            ['a malformed uuid', {variantIds: ['nope']}],
            ['more than 200 ids', {variantIds: Array.from({length: 201}, () => randomId())}],
        ])('rejects %s', async (_label, body) => {
            const target = await createProduct(admin)

            expectValidationError(await admin.post(`/admin/products/${target.id}/variants/move`, body))
        })

        it('returns 400 for a malformed target id', async () => {
            expectValidationError(
                await admin.post('/admin/products/not-a-uuid/variants/move', {variantIds: [randomId()]}),
            )
        })
    })


    describe('POST /admin/products/:id/merge', () => {
        it('moves every variant of the source into the target and archives the source', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{size: '40'}, {size: '41', isActive: false}])
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            const res = await admin.post(`/admin/products/${target.id}/merge`, {sourceProductId: source.id})

            expectOk(res, 200, 'PRODUCT_MERGE_SUCCESS')
            expect(res.json().data.id).toBe(target.id)
            expect(variantIdsOf(res.json().data)).toEqual(
                sorted([...source.variants.map((v) => v.id), target.variants[0].id]),
            )
            const storedSource = await getAdminProduct(admin, source.id)
            expect(storedSource.status).toBe('archived')
            expect(storedSource.variants).toEqual([])
            expect((await getAdminProduct(admin, target.id)).variants).toHaveLength(3)
        })

        it('removes a published source from the public catalog and leaves the target status alone', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {variants: [{size: '40'}]})
            const target = await createPublishedProduct(ctx.app, admin, {variants: [{size: '41'}]})

            const res = await admin.post(`/admin/products/${target.id}/merge`, {sourceProductId: source.id})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.status).toBe('published')
            expect((await anonymous.get(`/products/${source.id}`)).statusCode).toBe(404)
            const publicTarget = (await anonymous.get(`/products/${target.id}`)).json().data
            expect(publicTarget.variants).toHaveLength(2)
        })

        it('archives a source without variants and keeps the target variants', async () => {
            const source = await createProduct(admin)
            const target = await createDraftProduct(ctx.app, admin, [{}])

            const res = await admin.post(`/admin/products/${target.id}/merge`, {sourceProductId: source.id})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.variants).toHaveLength(1)
            expect((await getAdminProduct(admin, source.id)).status).toBe('archived')
        })

        it('accepts a source that is already archived', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{size: '40'}])
            await admin.post(`/admin/products/${source.id}/archive`)
            const target = await createDraftProduct(ctx.app, admin, [{size: '41'}])

            const res = await admin.post(`/admin/products/${target.id}/merge`, {sourceProductId: source.id})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.variants).toHaveLength(2)
            expect((await getAdminProduct(admin, source.id)).status).toBe('archived')
        })

        it('rejects merging a product into itself', async () => {
            const product = await createProduct(admin)

            expectError(
                await admin.post(`/admin/products/${product.id}/merge`, {sourceProductId: product.id}),
                400,
                'PRODUCT_MERGE_SAME_PRODUCT',
            )
        })

        it('returns 404 for an unknown source or target', async () => {
            const product = await createProduct(admin)

            expectError(
                await admin.post(`/admin/products/${product.id}/merge`, {sourceProductId: randomId()}),
                404,
                'PRODUCT_NOT_FOUND',
            )
            expectError(
                await admin.post(`/admin/products/${randomId()}/merge`, {sourceProductId: product.id}),
                404,
                'PRODUCT_NOT_FOUND',
            )
        })

        it('returns 409 when the target is archived and leaves the source untouched', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])
            const target = await createProduct(admin)
            await admin.post(`/admin/products/${target.id}/archive`)

            expectError(
                await admin.post(`/admin/products/${target.id}/merge`, {sourceProductId: source.id}),
                409,
                'PRODUCT_ARCHIVED',
            )
            const storedSource = await getAdminProduct(admin, source.id)
            expect(storedSource.status).toBe('draft')
            expect(storedSource.variants).toHaveLength(1)
        })

        it('returns 400 when a source variant breaks the shoe rules and changes nothing', async () => {
            const seeded = await seedVariants(ctx.app, [{size: '40'}])
            const source = await createProduct(admin, {variantIds: [seeded.variants[0].id]})
            await breakVariant(seeded)
            const target = await createDraftProduct(ctx.app, admin, [{size: '42'}])

            expectError(
                await admin.post(`/admin/products/${target.id}/merge`, {sourceProductId: source.id}),
                400,
                'VARIANT_INVALID_ATTRIBUTES',
            )
            const storedSource = await getAdminProduct(admin, source.id)
            expect(storedSource.status).toBe('draft')
            expect(storedSource.variants).toHaveLength(1)
            expect((await getAdminProduct(admin, target.id)).variants).toHaveLength(1)
        })

        it('rejects a missing or malformed sourceProductId and a malformed target id', async () => {
            const product = await createProduct(admin)

            expectValidationError(await admin.post(`/admin/products/${product.id}/merge`, {}))
            expectValidationError(await admin.post(`/admin/products/${product.id}/merge`, {sourceProductId: 'nope'}))
            expectValidationError(await admin.post('/admin/products/not-a-uuid/merge', {sourceProductId: randomId()}))
        })
    })

    describe('POST /admin/products/:id/split', () => {
        it('creates a draft product with the chosen variants and inherits category and brand', async () => {
            const category = await createCategory(admin)
            const brand = await createBrand(admin)
            const source = await createDraftProduct(ctx.app, admin, [{size: '40'}, {size: '41'}, {size: '42'}], {
                categoryId: category.id,
                brandId: brand.id,
            })
            const body = {
                variantIds: [source.variants[1].id, source.variants[2].id],
                newProduct: newShoe({gender: 'women', material: 'mesh'}),
            }

            const res = await admin.post(`/admin/products/${source.id}/split`, body)

            expectOk(res, 201, 'PRODUCT_SPLIT_SUCCESS')
            const {source: updatedSource, created} = res.json().data
            expect(created).toMatchObject({
                type: 'shoe',
                status: 'draft',
                name: body.newProduct.name,
                slug: body.newProduct.slug,
                categoryId: category.id,
                brandId: brand.id,
                images: [],
                details: {gender: 'women', material: 'mesh'},
            })
            expect(variantIdsOf(created)).toEqual(sorted([source.variants[1].id, source.variants[2].id]))
            created.variants.forEach((v: any) => expect(v.productId).toBe(created.id))
            expect(updatedSource.id).toBe(source.id)
            expect(variantIdsOf(updatedSource)).toEqual([source.variants[0].id])
            expect(updatedSource.status).toBe('draft')

            // persisted
            expect(variantIdsOf(await getAdminProduct(admin, created.id))).toEqual(variantIdsOf(created))
            expect(variantIdsOf(await getAdminProduct(admin, source.id))).toEqual([source.variants[0].id])
        })

        it('uses the category and brand of the new product when provided', async () => {
            const sourceCategory = await createCategory(admin)
            const newCategory = await createCategory(admin)
            const newBrand = await createBrand(admin)
            const source = await createDraftProduct(ctx.app, admin, [{size: '40'}, {size: '41'}], {
                categoryId: sourceCategory.id,
            })

            const res = await admin.post(`/admin/products/${source.id}/split`, {
                variantIds: [source.variants[0].id],
                newProduct: newShoe({categoryId: newCategory.id, brandId: newBrand.id}),
            })

            expect(res.json().data.created).toMatchObject({categoryId: newCategory.id, brandId: newBrand.id})
            expect(res.json().data.source.categoryId).toBe(sourceCategory.id)
        })

        it('keeps a published source published while it has an active variant left', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {variants: [{size: '40'}, {size: '41'}]})

            const res = await admin.post(`/admin/products/${source.id}/split`, {
                variantIds: [source.variantIds[1]],
                newProduct: newShoe(),
            })

            expect(res.statusCode).toBe(201)
            expect(res.json().data.source.status).toBe('published')
            expect(res.json().data.created.status).toBe('draft')
            expect((await anonymous.get(`/products/${source.id}`)).statusCode).toBe(200)
        })

        it('unpublishes a published source when every variant moves away', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {variants: [{size: '40'}, {size: '41'}]})

            const res = await admin.post(`/admin/products/${source.id}/split`, {
                variantIds: source.variantIds,
                newProduct: newShoe(),
            })

            expect(res.statusCode).toBe(201)
            expect(res.json().data.source.status).toBe('draft')
            expect(res.json().data.source.variants).toEqual([])
            expect((await anonymous.get(`/products/${source.id}`)).statusCode).toBe(404)
        })

        it('unpublishes a published source whose remaining variants are all inactive', async () => {
            const source = await createPublishedProduct(ctx.app, admin, {
                variants: [{size: '40'}, {size: '41', isActive: false}],
            })

            const res = await admin.post(`/admin/products/${source.id}/split`, {
                variantIds: [source.variantIds[0]],
                newProduct: newShoe(),
            })

            expect(res.json().data.source.status).toBe('draft')
        })

        it('returns 404 for an unknown source product', async () => {
            expectError(
                await admin.post(`/admin/products/${randomId()}/split`, {
                    variantIds: [randomId()],
                    newProduct: newShoe(),
                }),
                404,
                'PRODUCT_NOT_FOUND',
            )
        })

        it('returns 409 when the new slug is taken (case-insensitive)', async () => {
            const existing = await createProduct(admin)
            const source = await createDraftProduct(ctx.app, admin, [{}])

            expectError(
                await admin.post(`/admin/products/${source.id}/split`, {
                    variantIds: [source.variants[0].id],
                    newProduct: newShoe({slug: existing.slug.toUpperCase()}),
                }),
                409,
                'PRODUCT_SLUG_ALREADY_EXISTS',
            )
        })

        it('returns 404 for variants that do not belong to the source (unknown, foreign or unassigned)', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])
            const foreign = await createDraftProduct(ctx.app, admin, [{size: '41'}])
            const free = await seedVariants(ctx.app, [{size: '43'}])

            for (const variantId of [randomId(), foreign.variants[0].id, free.variants[0].id]) {
                expectError(
                    await admin.post(`/admin/products/${source.id}/split`, {
                        variantIds: [variantId],
                        newProduct: newShoe(),
                    }),
                    404,
                    'VARIANT_NOT_FOUND',
                )
            }
        })

        it('returns 404 for an unknown category or brand on the new product', async () => {
            const source = await createDraftProduct(ctx.app, admin, [{}])
            const send = (extra: Record<string, unknown>) =>
                admin.post(`/admin/products/${source.id}/split`, {
                    variantIds: [source.variants[0].id],
                    newProduct: newShoe(extra),
                })

            expectError(await send({categoryId: randomId()}), 404, 'CATEGORY_NOT_FOUND')
            expectError(await send({brandId: randomId()}), 404, 'BRAND_NOT_FOUND')
        })

        it('returns 400 when a moved variant breaks the shoe rules and creates nothing', async () => {
            const seeded = await seedVariants(ctx.app, [{size: '40'}, {size: '41'}])
            const source = await createProduct(admin, {variantIds: seeded.variants.map((v) => v.id)})
            await breakVariant(seeded, 1)
            const newProduct = newShoe()

            expectError(
                await admin.post(`/admin/products/${source.id}/split`, {
                    variantIds: [seeded.variants[1].id],
                    newProduct,
                }),
                400,
                'VARIANT_INVALID_ATTRIBUTES',
            )

            expect((await getAdminProduct(admin, source.id)).variants).toHaveLength(2)
            // the slug was not consumed by a half-created product
            expect((await admin.post('/admin/products', shoeBody({slug: newProduct.slug}))).statusCode).toBe(201)
        })

        const validSplit = () => ({variantIds: [randomId()], newProduct: newShoe()})
        const invalidSplits: [string, () => Record<string, unknown>][] = [
            ['missing variantIds', () => ({newProduct: newShoe()})],
            ['empty variantIds', () => ({...validSplit(), variantIds: []})],
            ['malformed variant uuid', () => ({...validSplit(), variantIds: ['nope']})],
            ['more than 200 variantIds', () => ({...validSplit(), variantIds: Array.from({length: 201}, () => randomId())})],
            ['missing newProduct', () => ({variantIds: [randomId()]})],
            ['unknown newProduct.type', () => ({...validSplit(), newProduct: newShoe({type: 'boat'})})],
            ['newProduct without name', () => ({...validSplit(), newProduct: newShoe({name: ''})})],
            ['newProduct with invalid slug', () => ({...validSplit(), newProduct: newShoe({slug: 'Bad Slug'})})],
            ['newProduct without gender', () => ({...validSplit(), newProduct: newShoe({gender: undefined})})],
        ]

        it.each(invalidSplits)('rejects %s', async (_label, build) => {
            const source = await createProduct(admin)

            expectValidationError(await admin.post(`/admin/products/${source.id}/split`, build()))
        })

        it('returns 400 for a malformed source id', async () => {
            expectValidationError(await admin.post('/admin/products/not-a-uuid/split', validSplit()))
        })
    })
})
