import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, UserSession, anonymousApi, createUserSession, qs, randomId, uid} from '../../util/test.util'
import {
    createBrand,
    createCategory,
    createDraftProduct,
    createPublishedProduct,
    unpublishProduct,
} from './product-test.util'

const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=120'

const directives = (header: unknown): Record<string, string | true> => {
    expect(typeof header).toBe('string')
    return Object.fromEntries(
        (header as string).split(',').map((part) => {
            const [name, value] = part.trim().toLowerCase().split('=')
            return [name, value ?? true]
        }),
    )
}

const isSharedCacheable = (header: unknown): boolean => {
    if (header === undefined) return false
    const d = directives(header)
    return !!d['public'] && !d['private'] && !d['no-store'] && Number(d['s-maxage'] ?? 0) > 0
}

describe('Public products: cache headers (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let anonymous: Api
    let shopper: UserSession
    let category: any
    let brand: any
    let first: Awaited<ReturnType<typeof createPublishedProduct>>
    let second: Awaited<ReturnType<typeof createPublishedProduct>>
    const tag = uid()
    type PublicRoute = [string, () => string]


    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        anonymous = anonymousApi(ctx.app)
        shopper = await createUserSession(ctx)
        category = await createCategory(admin)
        brand = await createBrand(admin)
        first = await createPublishedProduct(ctx.app, admin, {
            name: `Cache one ${tag}`, categoryId: category.id, brandId: brand.id, variants: [{price: 1000, stock: 10}],
        })
        second = await createPublishedProduct(ctx.app, admin, {
            name: `Cache two ${tag}`, categoryId: category.id, brandId: brand.id, variants: [{price: 2000, stock: 10}],
        })
    })

    const publicRoutes = (): PublicRoute[] => [
        ['the list', () => '/products?pageSize=5'],
        ['the search', () => `/products/search${qs({q: `Cache one ${tag}`})}`],
        ['the filters', () => '/products/filters'],
        ['the detail by id', () => `/products/${first.id}`],
        ['the detail by slug', () => `/products/slug/${first.slug}`],
    ]

    describe('successful responses', () => {
        it.each(publicRoutes())('%s carries the exact public cache header', async (_label, url) => {
            const res = await anonymous.get(url())

            expect(res.statusCode).toBe(200)
            expect(res.headers['cache-control']).toBe(CACHE)
        })

        it.each(publicRoutes())('%s may be stored by a shared cache for 60 s and revalidated by browsers', async (_label, url) => {
            const header = (await anonymous.get(url())).headers['cache-control']

            expect(isSharedCacheable(header)).toBe(true)
            expect(directives(header)).toEqual({
                public: true,
                'max-age': '0',
                's-maxage': '60',
                'stale-while-revalidate': '120',
            })
        })

        it('is set once (no duplicated header) on every route', async () => {
            for (const [, url] of publicRoutes()) {
                const header = (await anonymous.get(url())).headers['cache-control']

                expect(Array.isArray(header)).toBe(false)
                expect((header as string).match(/s-maxage/g)).toHaveLength(1)
            }
        })

        it('is also set when the result is empty', async () => {
            const emptyList = await anonymous.get(`/products${qs({categoryId: randomId()})}`)
            const emptySearch = await anonymous.get(`/products/search${qs({q: `no-such-product-${uid()}`})}`)
            const emptyFilters = await anonymous.get(`/products/filters${qs({categoryId: randomId()})}`)

            for (const res of [emptyList, emptySearch, emptyFilters]) {
                expect(res.statusCode).toBe(200)
                expect(res.headers['cache-control']).toBe(CACHE)
            }
            expect(emptyList.json().data.items).toEqual([])
        })

        it('is also set on later pages, filtered lists, sorted lists and search pages', async () => {
            const page1 = await anonymous.get(`/products${qs({categoryId: category.id, pageSize: 1})}`)
            const cursor = page1.json().data.nextCursor
            expect(cursor).toEqual(expect.any(String)) // two products in the category, one per page

            const urls = [
                `/products${qs({categoryId: category.id, pageSize: 1, nextCursor: cursor})}`,
                `/products${qs({brandId: brand.id, sort: 'minPrice:desc'})}`,
                `/products${qs({minPrice: 1500, inStock: true})}`,
                `/products/search${qs({q: tag, pageSize: 1})}`,
                `/products/filters${qs({categoryId: category.id})}`,
            ]
            for (const url of urls) {
                const res = await anonymous.get(url)

                expect(res.statusCode).toBe(200)
                expect(res.headers['cache-control']).toBe(CACHE)
            }
        })

        it('is the same whether or not the visitor is signed in', async () => {
            for (const [, url] of publicRoutes()) {
                const asShopper = await shopper.api.get(url())

                expect(asShopper.headers['cache-control']).toBe(CACHE)
            }
        })

        it('does not depend on the request headers (a browser reload with no-cache still gets the same answer headers)', async () => {
            const res = await ctx.app.inject({method: 'GET', url: `/products/${first.id}`, headers: {'cache-control': 'no-cache'}})

            expect(res.statusCode).toBe(200)
            expect(res.headers['cache-control']).toBe(CACHE)
        })
    })

    describe('responses that must not be cached publicly', () => {
        it.each([
            ['an unknown product id', () => `/products/${randomId()}`, 404],
            ['an unknown slug', () => '/products/slug/no-such-product-slug', 404],
            ['a malformed id', () => '/products/not-a-uuid', 400],
            ['a malformed slug', () => '/products/slug/Bad%20Slug', 400],
            ['an invalid list query', () => '/products?pageSize=0', 400],
            ['an invalid sort', () => '/products?sort=name:up', 400],
            ['an invalid search (no q)', () => '/products/search', 400],
            ['an invalid filters query', () => '/products/filters?categoryId=nope', 400],
        ])('%s is not stored by shared caches', async (_label, url, status) => {
            const res = await anonymous.get(url())

            expect(res.statusCode).toBe(status)
            expect(isSharedCacheable(res.headers['cache-control'])).toBe(false)
        })

        it('is not cacheable for a draft or an unpublished product (a later publish must show up at once)', async () => {
            const draft = await createDraftProduct(ctx.app, admin, [{}])
            const unpublished = await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{}]})
            await unpublishProduct(admin, unpublished.id)

            for (const id of [draft.id, unpublished.id]) {
                const res = await anonymous.get(`/products/${id}`)

                expect(res.statusCode).toBe(404)
                expect(isSharedCacheable(res.headers['cache-control'])).toBe(false)
            }
        })

        it('is not set on the admin product routes', async () => {
            const adminList = await admin.get('/admin/products?pageSize=5')
            const adminDetail = await admin.get(`/admin/products/${first.id}`)

            expect(adminList.statusCode).toBe(200)
            expect(adminDetail.statusCode).toBe(200)
            expect(isSharedCacheable(adminList.headers['cache-control'])).toBe(false)
            expect(isSharedCacheable(adminDetail.headers['cache-control'])).toBe(false)
        })

        it('is not set on private routes of other modules that sit next to the catalog', async () => {
            await shopper.api.get('/favorites/ids')
            const cart = await shopper.api.get('/cart')
            const me = await shopper.api.get('/users/me')

            for (const res of [cart, me]) {
                expect(res.statusCode).toBe(200)
                expect(isSharedCacheable(res.headers['cache-control'])).toBe(false)
            }
        })
    })

    describe('safe to share', () => {
        it.each(publicRoutes())('%s sets no cookie, so a CDN is allowed to store it', async (_label, url) => {
            const anonymousRes = await anonymous.get(url())
            const signedInRes = await shopper.api.get(url())

            expect(anonymousRes.headers['set-cookie']).toBeUndefined()
            expect(signedInRes.headers['set-cookie']).toBeUndefined()
        })

        it.each(publicRoutes())('%s has the same body for a visitor and for a signed-in shopper', async (_label, url) => {
            const visitor = (await anonymous.get(url())).json()
            const signedIn = (await shopper.api.get(url())).json()

            // nothing user-specific may be in a response that a shared cache hands to everybody
            expect(signedIn.data).toEqual(visitor.data)
        })

        it('does not vary the answer by a cart or favorites of the shopper', async () => {
            await shopper.api.put(`/favorites/${first.id}`)
            await shopper.api.post('/cart/items', {variantId: first.variantIds[0], quantity: 1})

            const visitor = (await anonymous.get(`/products/${first.id}`)).json().data
            const signedIn = (await shopper.api.get(`/products/${first.id}`)).json().data

            expect(signedIn).toEqual(visitor)
            expect(JSON.stringify(signedIn)).not.toMatch(/favorit|cart/i)
        })
    })

    describe('the origin itself is never stale', () => {
        // the header lets a CDN keep a response for a minute, but the app must not add its own cache on top
        it('shows a renamed product on the very next request', async () => {
            const product = await createPublishedProduct(ctx.app, admin, {
                name: `Fresh ${tag}`, categoryId: category.id, variants: [{price: 1000, stock: 10}],
            })
            expect((await anonymous.get(`/products/${product.id}`)).json().data.name).toBe(`Fresh ${tag}`)

            await admin.patch(`/admin/products/${product.id}`, {name: `Renamed ${tag}`})

            expect((await anonymous.get(`/products/${product.id}`)).json().data.name).toBe(`Renamed ${tag}`)
            const listed = (await anonymous.get('/products?pageSize=100')).json().data.items.find((i: any) => i.id === product.id)
            expect(listed.name).toBe(`Renamed ${tag}`)
        })

        it('stops showing an unpublished product at once, in the list, the search and the detail', async () => {
            const product = await createPublishedProduct(ctx.app, admin, {
                name: `Vanishing ${tag}`, categoryId: category.id, variants: [{}],
            })
            const listedIds = async () => ((await anonymous.get('/products?pageSize=100')).json().data.items as any[]).map((i) => i.id)
            expect(await listedIds()).toContain(product.id)

            await unpublishProduct(admin, product.id)

            expect(await listedIds()).not.toContain(product.id)
            expect((await anonymous.get(`/products/${product.id}`)).statusCode).toBe(404)
            expect((await anonymous.get(`/products/search${qs({q: `Vanishing ${tag}`})}`)).json().data.items).toEqual([])
        })

        it('shows a new product in the list on the next request', async () => {
            const before = (await anonymous.get('/products?pageSize=100')).json().data.items.length

            await createPublishedProduct(ctx.app, admin, {name: `Brand new ${tag}`, categoryId: category.id, variants: [{}]})

            expect((await anonymous.get('/products?pageSize=100')).json().data.items).toHaveLength(before + 1)
        })

        it('keeps the cache header on the refreshed response', async () => {
            const res = await anonymous.get('/products?pageSize=100')

            expect(res.headers['cache-control']).toBe(CACHE)
        })
    })
})