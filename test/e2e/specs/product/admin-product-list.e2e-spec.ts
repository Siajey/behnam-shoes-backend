import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    AR_NAME,
    createSession,
    expectError,
    expectOk,
    expectValidationError,
    FA_NAME,
    idsOf,
    qs,
    randomId,
    sleep,
    uid,
    walkPages,
} from '../../../util/test.util'
import {
    createBrand,
    createCategory,
    createProduct,
    createPublishedProduct,
    getAdminProduct,
    optionMap,
} from './product-test.util'

describe('Admin products: detail and list (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    const tag = uid()

    const ids: Record<'published1' | 'published2' | 'draft' | 'archived', string> = {
        published1: '',
        published2: '',
        draft: '',
        archived: '',
    }
    let brandA: any
    let brandB: any
    let root: any
    let child: any
    let other: any

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))

        brandA = await createBrand(admin)
        brandB = await createBrand(admin)
        root = await createCategory(admin)
        child = await createCategory(admin, {parentId: root.id})
        other = await createCategory(admin)

        const p1 = await createPublishedProduct(ctx.app, admin, {
            name: `Admin Alpha ${tag}`,
            categoryId: child.id,
            brandId: brandA.id,
            images: 2,
            variants: [
                {size: '40', color: 'black', price: 1000, stock: 5},
                {size: '41', color: 'white', price: 1500, stock: 0},
                {size: '42', color: 'black', price: 100, stock: 9, isActive: false},
            ],
        })
        ids.published1 = p1.id
        await sleep(15)

        const p2 = await createPublishedProduct(ctx.app, admin, {
            name: `Admin Beta ${tag}`,
            categoryId: root.id,
            brandId: brandB.id,
            variants: [{size: '38', color: 'red', price: 3000, stock: 2}],
        })
        ids.published2 = p2.id
        await sleep(15)

        const draft = await createProduct(admin, {name: `${FA_NAME} ${tag}`})
        ids.draft = draft.id
        await sleep(15)

        const archived = await createPublishedProduct(ctx.app, admin, {
            name: `Admin Archived ${tag}`,
            categoryId: other.id,
            variants: [{size: '44', color: 'blue', price: 2000, stock: 1}],
        })
        await admin.post(`/admin/products/${archived.id}/archive`)
        ids.archived = archived.id
    })

    const allIds = () => Object.values(ids)

    describe('GET /admin/products/:id', () => {
        it('returns a published product with images, price summary, options and all variants', async () => {
            const res = await admin.get(`/admin/products/${ids.published1}`)

            expectOk(res, 200, 'PRODUCT_GET_SUCCESS')
            const data = res.json().data
            expect(data).toMatchObject({
                id: ids.published1,
                type: 'shoe',
                status: 'published',
                brandId: brandA.id,
                categoryId: child.id,
                minPrice: 1000,
                maxPrice: 1500,
                inStock: true,
                details: {gender: 'unisex', material: null},
            })
            expect(data.images.map((i: any) => i.position)).toEqual([0, 1])
            expect(data.variants).toHaveLength(3) // admin sees inactive variants too
            expect(optionMap(data.options)).toEqual({size: ['40', '41'], color: ['black', 'white']})
        })

        it('returns drafts and archived products as well (unlike the public API)', async () => {
            expect((await getAdminProduct(admin, ids.draft)).status).toBe('draft')
            expect((await getAdminProduct(admin, ids.archived)).status).toBe('archived')
        })

        it('returns 404 for an unknown product and 400 for a malformed id', async () => {
            expectError(await admin.get(`/admin/products/${randomId()}`), 404, 'PRODUCT_NOT_FOUND')
            expectValidationError(await admin.get('/admin/products/not-a-uuid'))
        })
    })

    describe('GET /admin/products', () => {
        const list = (params: Record<string, any> = {}) => admin.get(`/admin/products${qs(params)}`)

        it('lists products of every status by default', async () => {
            const res = await list({pageSize: 100})

            expectOk(res, 200, 'PRODUCT_LIST_SUCCESS')
            expect(idsOf(res.json().data.items).sort()).toEqual(allIds().sort())
        })

        it('returns the admin list item shape', async () => {
            const items = (await list({pageSize: 100})).json().data.items as any[]

            const published = items.find((i) => i.id === ids.published1)
            expect(published).toEqual({
                id: ids.published1,
                type: 'shoe',
                name: `Admin Alpha ${tag}`,
                slug: expect.any(String),
                status: 'published',
                categoryId: child.id,
                brandId: brandA.id,
                primaryImage: {fileKey: expect.any(String), altText: expect.any(String)},
                minPrice: 1000,
                maxPrice: 1500,
                inStock: true,
                variantCount: 3,
                activeVariantCount: 2,
                updatedAt: expect.any(String),
            })

            const draft = items.find((i) => i.id === ids.draft)
            expect(draft).toMatchObject({
                status: 'draft',
                primaryImage: null,
                minPrice: null,
                maxPrice: null,
                inStock: false,
                variantCount: 0,
                activeVariantCount: 0,
            })
        })

        it('orders by newest first by default', async () => {
            const items = (await list({pageSize: 100})).json().data.items as any[]

            expect(idsOf(items)).toEqual([ids.archived, ids.draft, ids.published2, ids.published1])
        })

        describe('statuses filter', () => {
            it.each([
                ['draft', ['draft']],
                ['published', ['published1', 'published2']],
                ['published,archived', ['published1', 'published2', 'archived']],
                [' published , draft ', ['published1', 'published2', 'draft']],
            ])('statuses=%p', async (statuses, expected) => {
                const res = await list({statuses, pageSize: 100})

                expect(idsOf(res.json().data.items).sort()).toEqual(
                    (expected as (keyof typeof ids)[]).map((k) => ids[k]).sort(),
                )
            })

            it('treats an empty statuses value as "all"', async () => {
                const res = await list({statuses: '', pageSize: 100})

                expect(idsOf(res.json().data.items)).toHaveLength(allIds().length)
            })

            it('rejects an unknown status', async () => {
                expectValidationError(await list({statuses: 'published,deleted'}))
            })
        })

        describe('text search (q)', () => {
            it('matches the name case-insensitively', async () => {
                const res = await list({q: `ALPHA ${tag}`})

                expect(idsOf(res.json().data.items)).toEqual([ids.published1])
            })

            it('matches Persian names typed with Arabic kaf/yeh', async () => {
                const res = await list({q: AR_NAME})

                expect(idsOf(res.json().data.items)).toEqual([ids.draft])
            })

            it('accepts a single character (admin only) and rejects an over-long term', async () => {
                expect((await list({q: 'a'})).statusCode).toBe(200)
                expectValidationError(await list({q: 'a'.repeat(101)}))
            })

            it('combines with the statuses filter', async () => {
                const res = await list({q: `Admin`, statuses: 'archived'})

                expect(idsOf(res.json().data.items)).toEqual([ids.archived])
            })

            it('returns an empty page for unmatched terms', async () => {
                const res = await list({q: 'no-such-product-zzz'})

                expect(res.json().data).toEqual({items: [], nextCursor: null})
            })
        })

        describe('filters', () => {
            it('filters by brandId', async () => {
                const res = await list({brandId: brandA.id})

                expect(idsOf(res.json().data.items)).toEqual([ids.published1])
            })

            it('filters by categoryId including descendants', async () => {
                const byRoot = await list({categoryId: root.id})
                expect(idsOf(byRoot.json().data.items).sort()).toEqual([ids.published1, ids.published2].sort())

                const byChild = await list({categoryId: child.id})
                expect(idsOf(byChild.json().data.items)).toEqual([ids.published1])
            })

            it('filters by type and rejects an unknown type', async () => {
                const res = await list({type: 'shoe', pageSize: 100})
                expect(idsOf(res.json().data.items)).toHaveLength(allIds().length)

                expectValidationError(await list({type: 'boat'}))
            })

            it('rejects malformed ids', async () => {
                expectValidationError(await list({brandId: 'nope'}))
                expectValidationError(await list({categoryId: 'nope'}))
            })
        })

        describe('sorting and pagination', () => {
            it('sorts by name', async () => {
                const asc = (await list({sort: 'name:asc', pageSize: 100})).json().data.items as any[]
                const latin = asc.filter((i) => i.name.startsWith('Admin')).map((i) => i.name)

                expect(latin).toEqual([`Admin Alpha ${tag}`, `Admin Archived ${tag}`, `Admin Beta ${tag}`])

                const desc = (await list({sort: 'name:desc', pageSize: 100})).json().data.items as any[]
                expect(desc.filter((i) => i.name.startsWith('Admin')).map((i) => i.name)).toEqual(
                    [...latin].reverse(),
                )
            })

            it('sorts by minPrice (products without variants count as 0)', async () => {
                const res = await list({sort: 'minPrice:asc', pageSize: 100})

                expect(idsOf(res.json().data.items)).toEqual([
                    ids.draft,
                    ids.published1,
                    ids.archived,
                    ids.published2,
                ])
            })

            it('walks all pages with pageSize=2 without gaps or duplicates', async () => {
                const full = (await list({sort: 'name:asc', pageSize: 100})).json().data.items as any[]

                const pages = await walkPages(admin, '/admin/products', {sort: 'name:asc', pageSize: 2})

                expect(pages.map((p) => p.items.length)).toEqual([2, 2])
                expect(pages[pages.length - 1].nextCursor).toBeNull()
                expect(pages.flatMap((p) => idsOf(p.items))).toEqual(idsOf(full))
            })

            it('rejects invalid pagination and sort values', async () => {
                expectValidationError(await list({pageSize: 0}))
                expectValidationError(await list({pageSize: 101}))
                expectValidationError(await list({pageSize: 'abc'}))
                expectValidationError(await list({sort: 'name:up'}))
                expectValidationError(await list({sort: 'min-price'}))
                expectValidationError(await list({nextCursor: 'x'.repeat(513)}))
            })

            it('ignores unknown sort fields and malformed cursors', async () => {
                const unknownSort = await list({sort: 'colour:asc', pageSize: 100})
                expect(idsOf(unknownSort.json().data.items)).toEqual([
                    ids.archived,
                    ids.draft,
                    ids.published2,
                    ids.published1,
                ])

                const badCursor = await list({nextCursor: 'not-a-real-cursor', pageSize: 100})
                expect(badCursor.statusCode).toBe(200)
                expect(idsOf(badCursor.json().data.items)).toHaveLength(allIds().length)
            })
        })
    })
})
