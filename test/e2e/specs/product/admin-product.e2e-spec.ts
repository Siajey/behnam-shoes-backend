import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    AR_NAME,
    Api,
    FA_NAME,
    PERSIAN_FORTY_TWO,
    createBrand,
    createCategory,
    createProduct,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    getAdminProduct,
    idsOf,
    omit,
    optionMap,
    randomId,
    seedVariants,
    setGallery,
    shoeBody,
    sleep,
    slug,
    uid,
    walkPages,
} from './product-test.util'

describe('Admin products: create, update, gallery (e2e)', () => {
    let ctx: TestContext
    let admin: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
    })

    describe('POST /admin/products', () => {
        it('creates a draft shoe product with empty relations', async () => {
            const body = shoeBody({material: 'leather'})

            const res = await admin.post('/admin/products', body)

            expectOk(res, 201, 'PRODUCT_CREATE_SUCCESS')
            expect(res.json().data).toEqual({
                id: expect.any(String),
                type: 'shoe',
                name: body.name,
                slug: body.slug,
                description: body.description,
                status: 'draft',
                categoryId: null,
                brandId: null,
                images: [],
                details: {gender: 'unisex', material: 'leather'},
                publishedAt: null,
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
                minPrice: null,
                maxPrice: null,
                inStock: false,
                options: [],
                variants: [],
            })
        })

        it('stores category and brand when they exist', async () => {
            const category = await createCategory(admin)
            const brand = await createBrand(admin)

            const res = await admin.post(
                '/admin/products',
                shoeBody({categoryId: category.id, brandId: brand.id}),
            )

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({categoryId: category.id, brandId: brand.id})
        })

        it.each(['men', 'women', 'unisex', 'kids'])('accepts the gender %s', async (gender) => {
            const res = await admin.post('/admin/products', shoeBody({gender}))

            expect(res.statusCode).toBe(201)
            expect(res.json().data.details.gender).toBe(gender)
        })

        it('treats material as optional/nullable', async () => {
            const omitted = await admin.post('/admin/products', shoeBody())
            const nulled = await admin.post('/admin/products', shoeBody({material: null}))

            expect(omitted.json().data.details.material).toBeNull()
            expect(nulled.json().data.details.material).toBeNull()
        })

        it('trims the name, lowercases the slug and normalises Persian letters', async () => {
            const tag = uid()
            const res = await admin.post(
                '/admin/products',
                shoeBody({name: `  ${AR_NAME} ${tag} `, slug: `MIXED-${tag}`, description: AR_NAME}),
            )

            expect(res.statusCode).toBe(201)
            expect(res.json().data).toMatchObject({
                name: `${FA_NAME} ${tag}`,
                slug: `mixed-${tag}`,
                description: FA_NAME,
            })
        })

        const invalidBodies: [string, () => Record<string, unknown>][] = [
            ['missing type', () => omit(shoeBody(), 'type')],
            ['unknown type', () => shoeBody({type: 'boat'})],
            ['missing name', () => omit(shoeBody(), 'name')],
            ['blank name', () => shoeBody({name: '   '})],
            ['name over 200 chars', () => shoeBody({name: 'a'.repeat(201)})],
            ['missing slug', () => omit(shoeBody(), 'slug')],
            ['slug with a space', () => shoeBody({slug: 'bad slug'})],
            ['slug over 220 chars', () => shoeBody({slug: 'a'.repeat(221)})],
            ['missing description', () => omit(shoeBody(), 'description')],
            ['description over 5000 chars', () => shoeBody({description: 'a'.repeat(5001)})],
            ['description not a string', () => shoeBody({description: 12})],
            ['missing gender', () => omit(shoeBody(), 'gender')],
            ['unknown gender', () => shoeBody({gender: 'alien'})],
            ['empty material', () => shoeBody({material: ''})],
            ['material over 100 chars', () => shoeBody({material: 'm'.repeat(101)})],
            ['malformed categoryId', () => shoeBody({categoryId: 'nope'})],
            ['malformed brandId', () => shoeBody({brandId: 'nope'})],
            ['variantIds not an array', () => shoeBody({variantIds: 'abc'})],
            ['variantIds with a malformed uuid', () => shoeBody({variantIds: ['nope']})],
            ['more than 200 variantIds', () => shoeBody({variantIds: Array.from({length: 201}, () => randomId())})],
        ]

        it.each(invalidBodies)('rejects %s', async (_label, build) => {
            expectValidationError(await admin.post('/admin/products', build()))
        })

        it('rejects a duplicate slug (case-insensitive)', async () => {
            const existing = await createProduct(admin)

            const res = await admin.post('/admin/products', shoeBody({slug: existing.slug.toUpperCase()}))

            expectError(res, 409, 'PRODUCT_SLUG_ALREADY_EXISTS')
        })

        it('rejects an unknown category or brand', async () => {
            expectError(
                await admin.post('/admin/products', shoeBody({categoryId: randomId()})),
                404,
                'CATEGORY_NOT_FOUND',
            )
            expectError(
                await admin.post('/admin/products', shoeBody({brandId: randomId()})),
                404,
                'BRAND_NOT_FOUND',
            )
        })

        describe('with variantIds', () => {
            it('assigns the variants and returns price range, stock and options', async () => {
                const {variants} = await seedVariants(ctx.app, [
                    {size: '40', color: 'black', price: 1000, stock: 3},
                    {size: '41', color: 'white', price: 2500, stock: 0},
                    {size: '42', color: 'black', price: 100, stock: 9, isActive: false},
                ])
                const product = await createProduct(admin, {variantIds: variants.map((v) => v.id)})

                expect(product.variants).toHaveLength(3)
                expect(idsOf(product.variants).sort()).toEqual(variants.map((v) => v.id).sort())
                product.variants.forEach((v: any) => expect(v.productId).toBe(product.id))
                // inactive variants do not count for prices/options, but available ones make it in stock
                expect(product.minPrice).toBe(1000)
                expect(product.maxPrice).toBe(2500)
                expect(product.inStock).toBe(true)
                expect(optionMap(product.options)).toEqual({size: ['40', '41'], color: ['black', 'white']})
            })

            it('returns the admin variant shape', async () => {
                const {variants, items} = await seedVariants(ctx.app, [{size: '43', color: 'red', price: 777, stock: 4}])
                const product = await createProduct(admin, {variantIds: [variants[0].id]})

                const variant = product.variants[0]
                expect(variant).toEqual({
                    id: variants[0].id,
                    productId: product.id,
                    source: variants[0].source,
                    externalId: items[0].externalId,
                    sku: items[0].sku,
                    title: items[0].title,
                    price: 777,
                    stock: 4,
                    isActive: true,
                    attributes: expect.arrayContaining([
                        {name: 'size', value: '43'},
                        {name: 'color', value: 'red'},
                    ]),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String),
                })
            })

            it('removes the variants from the unassigned list', async () => {
                const {variants} = await seedVariants(ctx.app, [{}, {}])
                const before = (await walkPages(admin, '/admin/variants/unassigned', {pageSize: 100})).flatMap(
                    (p) => p.items,
                )
                expect(idsOf(before)).toEqual(expect.arrayContaining(variants.map((v) => v.id)))

                await createProduct(admin, {variantIds: variants.map((v) => v.id)})

                const after = (await walkPages(admin, '/admin/variants/unassigned', {pageSize: 100})).flatMap(
                    (p) => p.items,
                )
                variants.forEach((v) => expect(idsOf(after)).not.toContain(v.id))
            })

            it('ignores duplicate ids in variantIds', async () => {
                const {variants} = await seedVariants(ctx.app, [{}])

                const res = await admin.post(
                    '/admin/products',
                    shoeBody({variantIds: [variants[0].id, variants[0].id]}),
                )

                expect(res.statusCode).toBe(201)
                expect(res.json().data.variants).toHaveLength(1)
            })

            it('returns 404 when a variant does not exist', async () => {
                const res = await admin.post('/admin/products', shoeBody({variantIds: [randomId()]}))

                expectError(res, 404, 'VARIANT_NOT_FOUND')
            })

            it('returns 409 when a variant is already assigned to a product', async () => {
                const {variants} = await seedVariants(ctx.app, [{}])
                await createProduct(admin, {variantIds: [variants[0].id]})

                const res = await admin.post('/admin/products', shoeBody({variantIds: [variants[0].id]}))

                expectError(res, 409, 'VARIANT_ALREADY_ASSIGNED')
            })

            it('rejects variants without the required size/color attributes and creates nothing', async () => {
                const {variants} = await seedVariants(ctx.app, [{attributes: [{name: 'size', value: '42'}]}])
                const body = shoeBody({variantIds: [variants[0].id]})

                expectError(await admin.post('/admin/products', body), 400, 'VARIANT_INVALID_ATTRIBUTES')

                // nothing was persisted: the slug is still free and the variant is still unassigned
                const retry = await admin.post('/admin/products', {...body, variantIds: undefined})
                expect(retry.statusCode).toBe(201)
            })

            it.each(['16', '50', '42.5', '16.5', PERSIAN_FORTY_TWO])(
                'accepts the shoe size %p',
                async (size) => {
                    const {variants} = await seedVariants(ctx.app, [{size}])

                    const res = await admin.post('/admin/products', shoeBody({variantIds: [variants[0].id]}))

                    expect(res.statusCode).toBe(201)
                },
            )

            it.each(['15', '15.5', '50.5', '51', '42.3', 'abc', ''])(
                'rejects the shoe size %p',
                async (size) => {
                    const {variants} = await seedVariants(ctx.app, [{size}])

                    const res = await admin.post('/admin/products', shoeBody({variantIds: [variants[0].id]}))

                    expectError(res, 400, 'VARIANT_INVALID_ATTRIBUTES')
                },
            )

            it('rejects the whole request if only one of several variants is invalid', async () => {
                const {variants} = await seedVariants(ctx.app, [{size: '42'}, {size: '99'}])

                const res = await admin.post('/admin/products', shoeBody({variantIds: variants.map((v) => v.id)}))

                expectError(res, 400, 'VARIANT_INVALID_ATTRIBUTES')

                // the valid variant was not assigned as a side effect
                const unassigned = (await walkPages(admin, '/admin/variants/unassigned', {pageSize: 100})).flatMap(
                    (p) => p.items,
                )
                expect(idsOf(unassigned)).toEqual(expect.arrayContaining(variants.map((v) => v.id)))
            })
        })
    })

    describe('PATCH /admin/products/:id', () => {
        it('updates name and description', async () => {
            const product = await createProduct(admin)
            const name = `Updated ${uid()}`

            const res = await admin.patch(`/admin/products/${product.id}`, {name, description: 'New description'})

            expectOk(res, 200, 'PRODUCT_UPDATE_SUCCESS')
            expect(res.json().data).toMatchObject({
                id: product.id,
                name,
                description: 'New description',
                slug: product.slug,
                status: 'draft',
            })
        })

        it('normalises Persian letters on update', async () => {
            const product = await createProduct(admin)

            const res = await admin.patch(`/admin/products/${product.id}`, {name: AR_NAME, description: AR_NAME})

            expect(res.json().data).toMatchObject({name: FA_NAME, description: FA_NAME})
        })

        it('changes the slug of a draft product and frees the old one', async () => {
            const product = await createProduct(admin)
            const newSlug = slug('new-slug')

            const res = await admin.patch(`/admin/products/${product.id}`, {slug: newSlug})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.slug).toBe(newSlug)

            const reuse = await admin.post('/admin/products', shoeBody({slug: product.slug}))
            expect(reuse.statusCode).toBe(201)
        })

        it('allows re-sending the current slug', async () => {
            const product = await createProduct(admin)

            const res = await admin.patch(`/admin/products/${product.id}`, {slug: product.slug, name: `Same ${uid()}`})

            expect(res.statusCode).toBe(200)
        })

        it('rejects a slug used by another product', async () => {
            const other = await createProduct(admin)
            const product = await createProduct(admin)

            const res = await admin.patch(`/admin/products/${product.id}`, {slug: other.slug})

            expectError(res, 409, 'PRODUCT_SLUG_ALREADY_EXISTS')
        })

        it('sets category and brand, and clears them on a draft', async () => {
            const category = await createCategory(admin)
            const brand = await createBrand(admin)
            const product = await createProduct(admin)

            const set = await admin.patch(`/admin/products/${product.id}`, {
                categoryId: category.id,
                brandId: brand.id,
            })
            expect(set.json().data).toMatchObject({categoryId: category.id, brandId: brand.id})

            const cleared = await admin.patch(`/admin/products/${product.id}`, {categoryId: null, brandId: null})
            expect(cleared.statusCode).toBe(200)
            expect(cleared.json().data).toMatchObject({categoryId: null, brandId: null})
        })

        it('rejects an unknown category or brand', async () => {
            const product = await createProduct(admin)

            expectError(
                await admin.patch(`/admin/products/${product.id}`, {categoryId: randomId()}),
                404,
                'CATEGORY_NOT_FOUND',
            )
            expectError(
                await admin.patch(`/admin/products/${product.id}`, {brandId: randomId()}),
                404,
                'BRAND_NOT_FOUND',
            )
        })

        it('updates the shoe details independently', async () => {
            const product = await createProduct(admin, {gender: 'men', material: 'leather'})

            const genderOnly = await admin.patch(`/admin/products/${product.id}`, {shoe: {gender: 'women'}})
            expect(genderOnly.json().data.details).toEqual({gender: 'women', material: 'leather'})

            const materialCleared = await admin.patch(`/admin/products/${product.id}`, {shoe: {material: null}})
            expect(materialCleared.json().data.details).toEqual({gender: 'women', material: null})

            const both = await admin.patch(`/admin/products/${product.id}`, {
                shoe: {gender: 'kids', material: 'mesh'},
            })
            expect(both.json().data.details).toEqual({gender: 'kids', material: 'mesh'})
        })

        it('does not touch variants, images or status', async () => {
            const {variants} = await seedVariants(ctx.app, [{}, {size: '43'}])
            const product = await createProduct(admin, {variantIds: variants.map((v) => v.id)})
            await setGallery(admin, product.id, 2)

            const res = await admin.patch(`/admin/products/${product.id}`, {name: `Renamed ${uid()}`})

            expect(res.json().data.variants).toHaveLength(2)
            expect(res.json().data.images).toHaveLength(2)
            expect(res.json().data.status).toBe('draft')
        })

        it('advances updatedAt and keeps createdAt', async () => {
            const product = await createProduct(admin)
            await sleep(10)

            const res = await admin.patch(`/admin/products/${product.id}`, {description: 'changed'})

            expect(res.json().data.createdAt).toBe(product.createdAt)
            expect(new Date(res.json().data.updatedAt).getTime()).toBeGreaterThan(
                new Date(product.updatedAt).getTime(),
            )
        })

        const invalidPatches: [string, Record<string, unknown>][] = [
            ['an empty body', {}],
            ['only unknown fields', {foo: 'bar'}],
            ['a blank name', {name: ' '}],
            ['a name over 200 chars', {name: 'a'.repeat(201)}],
            ['an invalid slug', {slug: 'Bad Slug'}],
            ['a description over 5000 chars', {description: 'a'.repeat(5001)}],
            ['a malformed categoryId', {categoryId: 'nope'}],
            ['a malformed brandId', {brandId: 'nope'}],
            ['an unknown gender', {shoe: {gender: 'alien'}}],
            ['an empty material', {shoe: {material: ''}}],
        ]

        it.each(invalidPatches)('rejects %s', async (_label, body) => {
            const product = await createProduct(admin)

            expectValidationError(await admin.patch(`/admin/products/${product.id}`, body))
        })

        it('returns 404 for an unknown product and 400 for a malformed id', async () => {
            expectError(await admin.patch(`/admin/products/${randomId()}`, {name: 'x'}), 404, 'PRODUCT_NOT_FOUND')
            expectValidationError(await admin.patch('/admin/products/not-a-uuid', {name: 'x'}))
        })
    })

    describe('PUT /admin/products/:id/gallery', () => {
        it('replaces the gallery keeping the given order as positions', async () => {
            const product = await createProduct(admin)

            const res = await admin.put(`/admin/products/${product.id}/gallery`, {
                images: [
                    {fileKey: 'products/a.webp', altText: 'first'},
                    {fileKey: 'products/b.webp'},
                    {fileKey: 'products/c.webp', altText: null},
                ],
            })

            expectOk(res, 200, 'PRODUCT_GALLERY_UPDATE_SUCCESS')
            expect(res.json().data.images).toEqual([
                {id: expect.any(String), fileKey: 'products/a.webp', altText: 'first', position: 0},
                {id: expect.any(String), fileKey: 'products/b.webp', altText: null, position: 1},
                {id: expect.any(String), fileKey: 'products/c.webp', altText: null, position: 2},
            ])
            // gallery endpoint returns the product without variants
            expect(res.json().data.variants).toBeUndefined()
            expect(res.json().data.id).toBe(product.id)
        })

        it('is persisted and can be reordered', async () => {
            const product = await createProduct(admin)
            await admin.put(`/admin/products/${product.id}/gallery`, {
                images: [{fileKey: 'products/a.webp'}, {fileKey: 'products/b.webp'}],
            })

            await admin.put(`/admin/products/${product.id}/gallery`, {
                images: [{fileKey: 'products/b.webp'}, {fileKey: 'products/a.webp'}],
            })

            const stored = await getAdminProduct(admin, product.id)
            expect(stored.images.map((i: any) => [i.fileKey, i.position])).toEqual([
                ['products/b.webp', 0],
                ['products/a.webp', 1],
            ])
        })

        it('accepts exactly 12 images and rejects 13', async () => {
            const product = await createProduct(admin)
            const make = (n: number) => ({
                images: Array.from({length: n}, (_, i) => ({fileKey: `products/img-${i}.webp`})),
            })

            const ok = await admin.put(`/admin/products/${product.id}/gallery`, make(12))
            expect(ok.statusCode).toBe(200)
            expect(ok.json().data.images).toHaveLength(12)

            expectValidationError(await admin.put(`/admin/products/${product.id}/gallery`, make(13)))
            // the rejected request did not change the stored gallery
            expect((await getAdminProduct(admin, product.id)).images).toHaveLength(12)
        })

        it('clears the gallery with an empty array', async () => {
            const product = await createProduct(admin)
            await setGallery(admin, product.id, 3)

            const res = await admin.put(`/admin/products/${product.id}/gallery`, {images: []})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.images).toEqual([])
        })

        it('trims the fileKey', async () => {
            const product = await createProduct(admin)

            const res = await admin.put(`/admin/products/${product.id}/gallery`, {
                images: [{fileKey: '  products/trim.webp  '}],
            })

            expect(res.json().data.images[0].fileKey).toBe('products/trim.webp')
        })

        const invalidGalleries: [string, unknown][] = [
            ['a missing images field', {}],
            ['images that is not an array', {images: 'abc'}],
            ['an image without fileKey', {images: [{altText: 'x'}]}],
            ['an empty fileKey', {images: [{fileKey: '   '}]}],
            ['a fileKey over 255 chars', {images: [{fileKey: 'k'.repeat(256)}]}],
            ['an empty altText', {images: [{fileKey: 'a.webp', altText: ''}]}],
            ['an altText over 255 chars', {images: [{fileKey: 'a.webp', altText: 'a'.repeat(256)}]}],
        ]

        it.each(invalidGalleries)('rejects %s', async (_label, body) => {
            const product = await createProduct(admin)

            expectValidationError(await admin.put(`/admin/products/${product.id}/gallery`, body))
        })

        it('returns 404 for an unknown product and 400 for a malformed id', async () => {
            expectError(
                await admin.put(`/admin/products/${randomId()}/gallery`, {images: []}),
                404,
                'PRODUCT_NOT_FOUND',
            )
            expectValidationError(await admin.put('/admin/products/not-a-uuid/gallery', {images: []}))
        })
    })
})
