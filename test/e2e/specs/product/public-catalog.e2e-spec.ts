import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    AR_NAME,
    Api,
    FA_NAME,
    PERSIAN_FORTY,
    anonymousApi,
    createBrand,
    createCategory,
    createDraftProduct,
    createPublishedProduct,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    galleryImages,
    idsOf,
    optionMap,
    qs,
    randomId,
    sleep,
    uid,
    walkPages,
} from './product-test.util'

describe('Public catalog: list, search, detail (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api
    const tag = uid()

    let brandA: any
    let brandB: any
    let footwear: any
    let sneakers: any
    let boots: any
    let p1: Awaited<ReturnType<typeof createPublishedProduct>>
    let p2: Awaited<ReturnType<typeof createPublishedProduct>>
    let p3: Awaited<ReturnType<typeof createPublishedProduct>>
    let p4: Awaited<ReturnType<typeof createPublishedProduct>>
    let draftId: string
    let archivedId: string
    let p3Slug: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
        anonymous = anonymousApi(ctx.app)

        brandA = await createBrand(admin)
        brandB = await createBrand(admin)
        footwear = await createCategory(admin)
        sneakers = await createCategory(admin, {parentId: footwear.id})
        boots = await createCategory(admin)

        p1 = await createPublishedProduct(ctx.app, admin, {
            name: `Alpha Runner ${tag}`,
            categoryId: sneakers.id,
            brandId: brandA.id,
            gender: 'men',
            images: 3,
            variants: [
                {size: '40', color: 'black', price: 1000, stock: 5},
                {size: '41', color: 'white', price: 1500, stock: 0},
            ],
        })
        await sleep(15)
        p2 = await createPublishedProduct(ctx.app, admin, {
            name: `Beta Walker ${tag}`,
            categoryId: boots.id,
            brandId: brandB.id,
            gender: 'women',
            variants: [
                {size: '38', color: 'red', price: 3000, stock: 2},
                {size: '39', color: 'red', price: 3500, stock: 2},
            ],
        })
        await sleep(15)
        p3Slug = `special-moccasin-${tag}`
        p3 = await createPublishedProduct(ctx.app, admin, {
            name: `Gamma Loafer ${tag}`,
            slug: p3Slug,
            categoryId: footwear.id,
            brandId: brandA.id,
            gender: 'unisex',
            material: 'suede',
            variants: [
                {size: '42', color: 'black', price: 5000, stock: 0},
                {size: '43', color: 'black', price: 100, stock: 9, isActive: false},
            ],
        })
        await sleep(15)
        p4 = await createPublishedProduct(ctx.app, admin, {
            name: `${FA_NAME} ${tag}`,
            categoryId: footwear.id,
            brandId: brandB.id,
            gender: 'kids',
            variants: [{size: '44', color: 'blue', price: 2000, stock: 3}],
        })

        const draft = await createDraftProduct(ctx.app, admin, [{size: '45'}], {
            name: `Alpha Hidden Draft ${tag}`,
            categoryId: footwear.id,
        })
        draftId = draft.id
        const archived = await createPublishedProduct(ctx.app, admin, {
            name: `Alpha Hidden Archived ${tag}`,
            categoryId: footwear.id,
            variants: [{size: '46', color: 'pink', price: 10, stock: 1}],
        })
        await admin.post(`/admin/products/${archived.id}/archive`)
        archivedId = archived.id
    })

    const list = async (params: Record<string, any> = {}) => {
        const res = await anonymous.get(`/products${qs({pageSize: 100, ...params})}`)
        expect(res.statusCode).toBe(200)
        return res.json().data.items as any[]
    }
    const search = async (q: string, params: Record<string, any> = {}) => {
        const res = await anonymous.get(`/products/search${qs({pageSize: 100, ...params, q})}`)
        expect(res.statusCode).toBe(200)
        return res.json().data.items as any[]
    }
    const ids = (...products: { id: string }[]) => products.map((p) => p.id).sort()
    const sortedIds = (items: { id: string }[]) => idsOf(items).sort()

    /* ---------------------------------------------------------------- */

    describe('GET /products', () => {
        it('returns only published products and no auth is needed', async () => {
            const res = await anonymous.get(`/products${qs({pageSize: 100})}`)

            expectOk(res, 200, 'PRODUCT_LIST_SUCCESS')
            expect(sortedIds(res.json().data.items)).toEqual(ids(p1, p2, p3, p4))
            expect(idsOf(res.json().data.items)).not.toContain(draftId)
            expect(idsOf(res.json().data.items)).not.toContain(archivedId)
        })

        it('returns exactly the public list item shape (no admin fields, no stock)', async () => {
            const items = await list()

            const item = items.find((i) => i.id === p1.id)
            expect(item).toEqual({
                id: p1.id,
                type: 'shoe',
                name: `Alpha Runner ${tag}`,
                slug: p1.slug,
                categoryId: sneakers.id,
                brandId: brandA.id,
                primaryImage: {fileKey: `products/${p1.id}/img-0.webp`, altText: 'image 0'},
                minPrice: 1000,
                maxPrice: 1500,
                inStock: true,
                details: {gender: 'men', material: null},
            })
        })

        it('computes price range and stock from active variants only', async () => {
            const items = await list()
            const byId = new Map(items.map((i) => [i.id, i]))

            expect(byId.get(p2.id)).toMatchObject({minPrice: 3000, maxPrice: 3500, inStock: true})
            // p3: the cheap variant is inactive (ignored) and the active one has no stock
            expect(byId.get(p3.id)).toMatchObject({minPrice: 5000, maxPrice: 5000, inStock: false})
            expect(byId.get(p3.id).details).toEqual({gender: 'unisex', material: 'suede'})
        })

        it('orders by newest first by default', async () => {
            expect(idsOf(await list())).toEqual([p4.id, p3.id, p2.id, p1.id])
        })

        describe('sorting', () => {
            it('sorts by name asc/desc (default direction is asc)', async () => {
                const relevant = new Set([p1.id, p2.id, p3.id])

                const asc = idsOf(await list({sort: 'name:asc'})).filter((id) => relevant.has(id))
                const implicit = idsOf(await list({sort: 'name'})).filter((id) => relevant.has(id))
                const desc = idsOf(await list({sort: 'name:desc'})).filter((id) => relevant.has(id))

                expect(asc).toEqual([p1.id, p2.id, p3.id])
                expect(implicit).toEqual(asc)
                expect(desc).toEqual([p3.id, p2.id, p1.id])
            })

            it('sorts by minPrice and maxPrice', async () => {
                expect(idsOf(await list({sort: 'minPrice:asc'}))).toEqual([p1.id, p4.id, p2.id, p3.id])
                expect(idsOf(await list({sort: 'minPrice:desc'}))).toEqual([p3.id, p2.id, p4.id, p1.id])
                expect(idsOf(await list({sort: 'maxPrice:desc'}))).toEqual([p3.id, p2.id, p4.id, p1.id])
                expect(idsOf(await list({sort: 'maxPrice:asc'}))).toEqual([p1.id, p4.id, p2.id, p3.id])
            })

            it('sorts by createdAt asc', async () => {
                expect(idsOf(await list({sort: 'createdAt:asc'}))).toEqual([p1.id, p2.id, p3.id, p4.id])
            })

            it('ignores unknown sort fields and falls back to newest first', async () => {
                expect(idsOf(await list({sort: 'colour:asc'}))).toEqual([p4.id, p3.id, p2.id, p1.id])
            })

            it.each(['name:up', 'min-price', 'name:asc,', ':asc', 'name asc'])(
                'rejects the malformed sort %p',
                async (sort) => {
                    expectValidationError(await anonymous.get(`/products${qs({sort})}`))
                },
            )
        })

        describe('filters', () => {
            it('filters by brandId', async () => {
                expect(sortedIds(await list({brandId: brandA.id}))).toEqual(ids(p1, p3))
                expect(sortedIds(await list({brandId: brandB.id}))).toEqual(ids(p2, p4))
            })

            it('returns an empty page for a well-formed but unknown brand or category', async () => {
                const res = await anonymous.get(`/products${qs({brandId: randomId()})}`)
                expect(res.json().data).toEqual({items: [], nextCursor: null})

                const byCategory = await anonymous.get(`/products${qs({categoryId: randomId()})}`)
                expect(byCategory.json().data).toEqual({items: [], nextCursor: null})
            })

            it('filters by type and rejects unknown types', async () => {
                expect(await list({type: 'shoe'})).toHaveLength(4)
                expectValidationError(await anonymous.get(`/products${qs({type: 'sandal'})}`))
            })

            it('filters by category including its descendants', async () => {
                expect(sortedIds(await list({categoryId: footwear.id}))).toEqual(ids(p1, p3, p4))
                expect(sortedIds(await list({categoryId: sneakers.id}))).toEqual(ids(p1))
                expect(sortedIds(await list({categoryId: boots.id}))).toEqual(ids(p2))
            })

            it('filters by price using range overlap on active variants', async () => {
                // minPrice: product's highest active price must be >= value
                expect(sortedIds(await list({minPrice: 2500}))).toEqual(ids(p2, p3))
                // maxPrice: product's lowest active price must be <= value
                expect(sortedIds(await list({maxPrice: 1200}))).toEqual(ids(p1))
                // both: ranges overlap
                expect(sortedIds(await list({minPrice: 1200, maxPrice: 2200}))).toEqual(ids(p1, p4))
                // p3's inactive 100 variant must not make it match a low maxPrice
                expect(sortedIds(await list({maxPrice: 200}))).toEqual([])
            })

            it.each([
                ['minPrice', '-1'],
                ['minPrice', 'abc'],
                ['minPrice', '1.5'],
                ['maxPrice', '-5'],
                ['maxPrice', 'abc'],
            ])('rejects %s=%s', async (key, value) => {
                expectValidationError(await anonymous.get(`/products${qs({[key]: value})}`))
            })

            it('filters by inStock', async () => {
                expect(sortedIds(await list({inStock: true}))).toEqual(ids(p1, p2, p4))
                expect(sortedIds(await list({inStock: false}))).toEqual(ids(p3))
                expectValidationError(await anonymous.get(`/products${qs({inStock: 'yes'})}`))
            })

            describe('attributes', () => {
                const byAttributes = async (attributes: string) => sortedIds(await list({attributes}))

                it('matches a single attribute value', async () => {
                    expect(await byAttributes('size:40')).toEqual(ids(p1))
                    expect(await byAttributes('color:red')).toEqual(ids(p2))
                })

                it('matches any of several values of one attribute', async () => {
                    expect(await byAttributes('size:40,44')).toEqual(ids(p1, p4))
                    expect(await byAttributes('color:black,blue')).toEqual(ids(p1, p3, p4))
                })

                it('requires all attributes to match on the same variant', async () => {
                    expect(await byAttributes('size:41;color:white')).toEqual(ids(p1))
                    expect(await byAttributes('color:red;size:38')).toEqual(ids(p2))
                    // 40 is black and 41 is white: no single variant is (40, white)
                    expect(await byAttributes('size:40;color:white')).toEqual([])
                })

                it('is case-insensitive and understands Persian digits', async () => {
                    expect(await byAttributes('color:BLACK')).toEqual(ids(p1, p3))
                    expect(await byAttributes(`SIZE:${PERSIAN_FORTY}`)).toEqual(ids(p1))
                })

                it('ignores inactive variants', async () => {
                    expect(await byAttributes('size:43')).toEqual([])
                })

                it('returns nothing for unknown attributes or values', async () => {
                    expect(await byAttributes('size:99')).toEqual([])
                    expect(await byAttributes('material:wool')).toEqual([])
                })

                it('ignores malformed attribute strings (no values / no name)', async () => {
                    expect(await byAttributes('size:')).toHaveLength(4)
                    expect(await byAttributes(':40')).toHaveLength(4)
                })

                it('rejects an attributes string over 500 characters', async () => {
                    expectValidationError(await anonymous.get(`/products${qs({attributes: `size:${'4'.repeat(500)}`})}`))
                })
            })

            it('combines filters with AND', async () => {
                expect(sortedIds(await list({brandId: brandA.id, inStock: true}))).toEqual(ids(p1))
                expect(sortedIds(await list({brandId: brandA.id, categoryId: sneakers.id, attributes: 'color:black'}))).toEqual(
                    ids(p1),
                )
            })
        })
    })

    /* ---------------------------------------------------------------- */

    describe('GET /products/search', () => {
        it('matches the name case-insensitively and only returns published products', async () => {
            // two hidden products (draft + archived) also contain "alpha"
            expect(sortedIds(await search('alpha'))).toEqual(ids(p1))
            expect(sortedIds(await search('ALPHA RUNNER'))).toEqual(ids(p1))
        })

        it('matches part of the name and trims the term', async () => {
            expect(sortedIds(await search('  walker  '))).toEqual(ids(p2))
            expect(sortedIds(await search('er', {sort: 'name:asc'}))).toEqual(ids(p1, p2, p3))
        })

        it('also matches the slug', async () => {
            expect(sortedIds(await search('moccasin'))).toEqual(ids(p3))
        })

        it('finds Persian names when the term uses Arabic kaf/yeh', async () => {
            expect(sortedIds(await search(AR_NAME))).toEqual(ids(p4))
            expect(sortedIds(await search(FA_NAME))).toEqual(ids(p4))
        })

        it('returns an empty page when nothing matches', async () => {
            const res = await anonymous.get(`/products/search${qs({q: 'zzzz-no-match'})}`)

            expectOk(res, 200, 'PRODUCT_SEARCH_SUCCESS')
            expect(res.json().data).toEqual({items: [], nextCursor: null})
        })

        it('supports the same filters and sorting as the list', async () => {
            expect(sortedIds(await search('er', {brandId: brandA.id}))).toEqual(ids(p1, p3))
            expect(idsOf(await search('er', {sort: 'minPrice:desc'}))).toEqual([p3.id, p2.id, p1.id])
            expect(sortedIds(await search('er', {inStock: false}))).toEqual(ids(p3))
        })

        it('paginates with a cursor', async () => {
            const pages = await walkPages(anonymous, '/products/search', {q: 'er', pageSize: 2, sort: 'name:asc'})

            expect(pages.map((p) => p.items.length)).toEqual([2, 1])
            expect(pages.flatMap((p) => idsOf(p.items))).toEqual([p1.id, p2.id, p3.id])
        })

        it.each([
            ['missing q', {}],
            ['a one-character q', {q: 'a'}],
            ['a whitespace-only q', {q: '   '}],
            ['a q over 100 characters', {q: 'a'.repeat(101)}],
        ])('rejects %s', async (_label, params) => {
            expectValidationError(await anonymous.get(`/products/search${qs(params as any)}`))
        })
    })

    /* ---------------------------------------------------------------- */

    describe('GET /products/:id and /products/slug/:slug', () => {
        it('returns the public detail shape by id', async () => {
            const res = await anonymous.get(`/products/${p1.id}`)

            expectOk(res, 200, 'PRODUCT_GET_SUCCESS')
            expect(res.json().data).toEqual({
                id: p1.id,
                type: 'shoe',
                name: `Alpha Runner ${tag}`,
                slug: p1.slug,
                categoryId: sneakers.id,
                brandId: brandA.id,
                primaryImage: {fileKey: `products/${p1.id}/img-0.webp`, altText: 'image 0'},
                minPrice: 1000,
                maxPrice: 1500,
                inStock: true,
                details: {gender: 'men', material: null},
                description: expect.any(String),
                images: galleryImages(p1.id, 3),
                options: expect.any(Array),
                variants: expect.any(Array),
            })
        })

        it('returns the same product by slug', async () => {
            const byId = (await anonymous.get(`/products/${p1.id}`)).json().data
            const bySlug = await anonymous.get(`/products/slug/${p1.slug}`)

            expectOk(bySlug, 200, 'PRODUCT_GET_SUCCESS')
            expect(bySlug.json().data).toEqual(byId)
        })

        it('exposes only public variant fields and only for active variants', async () => {
            const data = (await anonymous.get(`/products/${p1.id}`)).json().data

            expect(data.variants).toHaveLength(2)
            const forty = data.variants.find((v: any) => v.id === p1.variantIds[0])
            expect(forty).toEqual({
                id: p1.variantIds[0],
                price: 1000,
                isAvailable: true,
                attributes: expect.arrayContaining([
                    {name: 'size', value: '40'},
                    {name: 'color', value: 'black'},
                ]),
            })
            const outOfStock = data.variants.find((v: any) => v.id === p1.variantIds[1])
            expect(outOfStock.isAvailable).toBe(false)
            expect(optionMap(data.options)).toEqual({size: ['40', '41'], color: ['black', 'white']})
        })

        it('hides inactive variants and their options', async () => {
            const data = (await anonymous.get(`/products/slug/${p3Slug}`)).json().data

            expect(data.variants).toHaveLength(1)
            expect(data.variants[0].id).toBe(p3.variantIds[0])
            expect(optionMap(data.options)).toEqual({size: ['42'], color: ['black']})
        })

        it('returns 404 PRODUCT_NOT_FOUND for draft, archived and unknown products', async () => {
            for (const id of [draftId, archivedId, randomId()]) {
                expectError(await anonymous.get(`/products/${id}`), 404, 'PRODUCT_NOT_FOUND')
            }
            expectError(await anonymous.get('/products/slug/does-not-exist'), 404, 'PRODUCT_NOT_FOUND')
        })

        it('returns 404 for the slug of a draft or archived product', async () => {
            const draft = (await admin.get(`/admin/products/${draftId}`)).json().data
            const archived = (await admin.get(`/admin/products/${archivedId}`)).json().data

            expectError(await anonymous.get(`/products/slug/${draft.slug}`), 404, 'PRODUCT_NOT_FOUND')
            expectError(await anonymous.get(`/products/slug/${archived.slug}`), 404, 'PRODUCT_NOT_FOUND')
        })

        it('returns 400 for a malformed id or slug', async () => {
            expectValidationError(await anonymous.get('/products/not-a-uuid'))
            expectValidationError(await anonymous.get('/products/slug/bad%20slug'))
            expectValidationError(await anonymous.get('/products/slug/under_score'))
        })

        it('does not confuse the static routes with an id', async () => {
            expect((await anonymous.get('/products/filters')).statusCode).toBe(200)
            expect((await anonymous.get('/products/search?q=ab')).statusCode).toBe(200)
        })
    })

    /* ---------------------------------------------------------------- */

    describe('late mutations (run last: they change the catalog)', () => {
        it('treats %, _ and \\ in the search term literally', async () => {
            const literal = await createPublishedProduct(ctx.app, admin, {
                name: `Under_score Runner ${tag}`,
                categoryId: footwear.id,
            })
            const wildcard = await createPublishedProduct(ctx.app, admin, {
                name: `UnderXscore Runner ${tag}`,
                categoryId: footwear.id,
            })

            expect(sortedIds(await search('der_sc'))).toEqual(ids(literal))
            expect(sortedIds(await search('derXsc'))).toEqual(ids(wildcard))
            expect(await search('%%')).toEqual([])
            expect(await search('\\_')).toEqual([])
        })

        it('uses the first gallery image as primaryImage and follows reordering', async () => {
            const product = await createPublishedProduct(ctx.app, admin, {categoryId: boots.id, images: 2})
            const before = (await list()).find((i) => i.id === product.id)
            expect(before.primaryImage.fileKey).toBe(`products/${product.id}/img-0.webp`)

            await admin.put(`/admin/products/${product.id}/gallery`, {
                images: [
                    {fileKey: `products/${product.id}/img-1.webp`, altText: 'second first'},
                    {fileKey: `products/${product.id}/img-0.webp`, altText: null},
                ],
            })

            const after = (await list()).find((i) => i.id === product.id)
            expect(after.primaryImage).toEqual({fileKey: `products/${product.id}/img-1.webp`, altText: 'second first'})
            const detail = (await anonymous.get(`/products/${product.id}`)).json().data
            expect(detail.images.map((i: any) => i.fileKey)).toEqual([
                `products/${product.id}/img-1.webp`,
                `products/${product.id}/img-0.webp`,
            ])
        })
    })
})
