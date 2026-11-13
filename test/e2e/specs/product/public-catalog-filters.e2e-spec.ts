import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    anonymousApi,
    Api,
    createSession,
    expectOk,
    expectValidationError,
    qs,
    randomId,
    uid,
} from '../../../util/test.util'
import {
    createBrand,
    createCategory,
    createDraftProduct,
    createPublishedProduct,
} from './product-test.util'

const byName = <T extends { name: string }>(items: T[]) => [...items].sort((a, b) => a.name.localeCompare(b.name))
const byValue = <T extends { value: string }>(items: T[]) => [...items].sort((a, b) => a.value.localeCompare(b.value))
const normaliseAttributes = (attributes: { name: string; values: { value: string; count: number }[] }[]) =>
    byName(attributes).map((a) => ({name: a.name, values: byValue(a.values)}))

describe('Public catalog: filters, brands, category tree (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
        anonymous = anonymousApi(ctx.app)
    })

    /* The database is reset between spec files, so this runs against an empty catalog. */
    describe('empty catalog', () => {
        it('GET /products/filters returns empty facets and a null price range', async () => {
            const res = await anonymous.get('/products/filters')

            expectOk(res, 200, 'PRODUCT_FILTERS_SUCCESS')
            expect(res.json().data).toEqual({categories: [], brands: [], priceRange: null, attributes: []})
        })

        it('GET /brands and GET /categories return empty lists', async () => {
            const brands = await anonymous.get('/brands')
            expectOk(brands, 200, 'BRAND_LIST_SUCCESS')
            expect(brands.json().data).toEqual([])

            const categories = await anonymous.get('/categories')
            expectOk(categories, 200, 'CATEGORY_LIST_SUCCESS')
            expect(categories.json().data).toEqual([])
        })
    })

    /* ---------------------------------------------------------------- */

    describe('GET /products/filters', () => {
        const tag = uid()
        let root: any
        let child: any
        let other: any
        let unusedCategory: any
        let acme: any
        let zenith: any
        let unusedBrand: any

        beforeAll(async () => {
            root = await createCategory(admin, {name: `${tag} Root`})
            child = await createCategory(admin, {name: `${tag} Child`, parentId: root.id})
            other = await createCategory(admin, {name: `${tag} Other`})
            unusedCategory = await createCategory(admin, {name: `${tag} Unused`})
            acme = await createBrand(admin, {name: `${tag} Acme`})
            zenith = await createBrand(admin, {name: `${tag} Zenith`})
            unusedBrand = await createBrand(admin, {name: `${tag} Unused Brand`})

            // A: published, category Child, brand Acme
            await createPublishedProduct(ctx.app, admin, {
                categoryId: child.id,
                brandId: acme.id,
                variants: [
                    {size: '40', color: 'black', price: 1000, stock: 1},
                    {size: '41', color: 'black', price: 1200, stock: 1},
                ],
            })
            // B: published, category Root, brand Acme; the 45/100 variant is inactive
            await createPublishedProduct(ctx.app, admin, {
                categoryId: root.id,
                brandId: acme.id,
                variants: [
                    {size: '40', color: 'white', price: 800, stock: 1},
                    {size: '45', color: 'white', price: 100, stock: 1, isActive: false},
                ],
            })
            // C: published, category Other, brand Zenith
            await createPublishedProduct(ctx.app, admin, {
                categoryId: other.id,
                brandId: zenith.id,
                variants: [{size: '42', color: 'black', price: 2500, stock: 0}],
            })
            // D: draft (must not show up anywhere)
            await createDraftProduct(ctx.app, admin, [{size: '46', color: 'green', price: 50000}], {
                categoryId: other.id,
                brandId: zenith.id,
            })
            // E: archived (must not show up anywhere)
            const archived = await createPublishedProduct(ctx.app, admin, {
                categoryId: child.id,
                brandId: zenith.id,
                variants: [{size: '49', color: 'pink', price: 70000, stock: 1}],
            })
            await admin.post(`/admin/products/${archived.id}/archive`)
        })

        const filters = async (params: Record<string, any> = {}) => {
            const res = await anonymous.get(`/products/filters${qs(params)}`)
            expect(res.statusCode).toBe(200)
            return res.json().data
        }

        it('counts published products per category and per brand, ignoring drafts and archived ones', async () => {
            const data = await filters()

            expect(byName(data.categories)).toEqual(
                byName([
                    {id: child.id, name: `${tag} Child`, slug: child.slug, count: 1},
                    {id: root.id, name: `${tag} Root`, slug: root.slug, count: 1},
                    {id: other.id, name: `${tag} Other`, slug: other.slug, count: 1},
                ]),
            )
            expect(byName(data.brands)).toEqual(
                byName([
                    {id: acme.id, name: `${tag} Acme`, slug: acme.slug, count: 2},
                    {id: zenith.id, name: `${tag} Zenith`, slug: zenith.slug, count: 1},
                ]),
            )
        })

        it('does not list categories or brands that have no published products', async () => {
            const data = await filters()

            expect(data.categories.map((c: any) => c.id)).not.toContain(unusedCategory.id)
            expect(data.brands.map((b: any) => b.id)).not.toContain(unusedBrand.id)
        })

        it('returns the price range of active variants of published products', async () => {
            const data = await filters()

            // inactive 100, draft 50000 and archived 70000 are ignored
            expect(data.priceRange).toEqual({min: 800, max: 2500})
        })

        it('groups attribute values with the number of distinct products, active variants only', async () => {
            const data = await filters()

            expect(normaliseAttributes(data.attributes)).toEqual([
                {
                    name: 'color',
                    values: [
                        {value: 'black', count: 2}, // A and C
                        {value: 'white', count: 1}, // B
                    ],
                },
                {
                    name: 'size',
                    values: [
                        {value: '40', count: 2}, // A and B
                        {value: '41', count: 1},
                        {value: '42', count: 1},
                    ],
                },
            ])
        })

        it('scopes all facets to a category and its descendants', async () => {
            const data = await filters({categoryId: root.id})

            expect(byName(data.categories).map((c: any) => [c.name, c.count])).toEqual(
                byName([
                    {name: `${tag} Child`, count: 1},
                    {name: `${tag} Root`, count: 1},
                ]).map((c) => [c.name, c.count]),
            )
            expect(data.brands).toEqual([{id: acme.id, name: `${tag} Acme`, slug: acme.slug, count: 2}])
            expect(data.priceRange).toEqual({min: 800, max: 1200})
            expect(normaliseAttributes(data.attributes)).toEqual([
                {name: 'color', values: [{value: 'black', count: 1}, {value: 'white', count: 1}]},
                {name: 'size', values: [{value: '40', count: 2}, {value: '41', count: 1}]},
            ])
        })

        it('scopes to a leaf category', async () => {
            const data = await filters({categoryId: other.id})

            expect(data.categories).toEqual([{id: other.id, name: `${tag} Other`, slug: other.slug, count: 1}])
            expect(data.brands).toEqual([{id: zenith.id, name: `${tag} Zenith`, slug: zenith.slug, count: 1}])
            expect(data.priceRange).toEqual({min: 2500, max: 2500})
        })

        it('returns empty facets for a category without published products', async () => {
            expect(await filters({categoryId: unusedCategory.id})).toEqual({
                categories: [],
                brands: [],
                priceRange: null,
                attributes: [],
            })
            expect(await filters({categoryId: randomId()})).toEqual({
                categories: [],
                brands: [],
                priceRange: null,
                attributes: [],
            })
        })

        it('rejects a malformed categoryId', async () => {
            expectValidationError(await anonymous.get('/products/filters?categoryId=nope'))
        })
    })

    /* ---------------------------------------------------------------- */

    describe('GET /brands', () => {
        it('lists every brand (including those without products) ordered by name, public fields only', async () => {
            const tag = uid()
            const charlie = await createBrand(admin, {name: `${tag} Charlie`, logoKey: 'brands/charlie.png'})
            const alpha = await createBrand(admin, {name: `${tag} Alpha`})

            const res = await anonymous.get('/brands')

            expectOk(res, 200, 'BRAND_LIST_SUCCESS')
            const mine = (res.json().data as any[]).filter((b) => b.name.startsWith(tag))
            expect(mine).toEqual([
                {id: alpha.id, name: `${tag} Alpha`, slug: alpha.slug, logoKey: null},
                {id: charlie.id, name: `${tag} Charlie`, slug: charlie.slug, logoKey: 'brands/charlie.png'},
            ])
        })

        it('reflects deletions immediately', async () => {
            const brand = await createBrand(admin)
            await admin.delete(`/admin/brands/${brand.id}`)

            const res = await anonymous.get('/brands')

            expect((res.json().data as any[]).some((b) => b.id === brand.id)).toBe(false)
        })
    })

    describe('GET /categories', () => {
        it('returns a nested tree ordered by sortOrder then name, with public fields only', async () => {
            const tag = uid()
            const second = await createCategory(admin, {name: `${tag} B-root`, sortOrder: 2})
            const first = await createCategory(admin, {name: `${tag} A-root`, sortOrder: 1})
            const childB = await createCategory(admin, {name: `${tag} Child B`, parentId: first.id, sortOrder: 1})
            const childA = await createCategory(admin, {name: `${tag} Child A`, parentId: first.id, sortOrder: 1})
            const grandchild = await createCategory(admin, {name: `${tag} Grandchild`, parentId: childA.id})

            const res = await anonymous.get('/categories')

            expectOk(res, 200, 'CATEGORY_LIST_SUCCESS')
            const roots = (res.json().data as any[]).filter((n) => n.name.startsWith(tag))
            expect(roots).toEqual([
                {
                    id: first.id,
                    name: `${tag} A-root`,
                    slug: first.slug,
                    children: [
                        {
                            id: childA.id,
                            name: `${tag} Child A`,
                            slug: childA.slug,
                            children: [{id: grandchild.id, name: `${tag} Grandchild`, slug: grandchild.slug, children: []}],
                        },
                        {id: childB.id, name: `${tag} Child B`, slug: childB.slug, children: []},
                    ],
                },
                {id: second.id, name: `${tag} B-root`, slug: second.slug, children: []},
            ])
        })

        it('only returns root categories at the top level', async () => {
            const parent = await createCategory(admin)
            const child = await createCategory(admin, {parentId: parent.id})

            const res = await anonymous.get('/categories')

            const topLevelIds = (res.json().data as any[]).map((n) => n.id)
            expect(topLevelIds).toContain(parent.id)
            expect(topLevelIds).not.toContain(child.id)
        })
    })
})
