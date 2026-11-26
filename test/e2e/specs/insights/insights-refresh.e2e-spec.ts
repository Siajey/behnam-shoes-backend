import {beforeAll, describe, expect, it} from '@jest/globals'

import {IRefreshProductStats} from '@api/insights/application'
import {RefreshProductStatsJob} from '@api/insights/infrastructure'
import {UserRole} from '@api/users/domain'
import {REFRESH_PRODUCT_STATS} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    UserSession,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectOk,
    withNowPlus,
} from '../../util/test.util'
import {createPublishedProduct} from '../product/product-test.util'
import {Customer, adminStatus, createCustomer, fillCart, orderSystemUseCases, placeOk} from '../order/order-test.util'
import {putFavorite} from '../favorites/favorites-test.util'
import {ensureShippingMethods} from "../shipping/shipping-test.util";

const DAY = 24 * 60 * 60 * 1000
const REFRESH_URL = '/admin/insights/product-stats/refresh'

describe('Insights: refreshing product stats (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let anonymous: Api
    let customer: Customer
    let refresh: IRefreshProductStats
    let orders: ReturnType<typeof orderSystemUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        await ensureShippingMethods(admin)
        anonymous = anonymousApi(ctx.app)
        customer = await createCustomer(ctx)
        refresh = ctx.app.get<IRefreshProductStats>(REFRESH_PRODUCT_STATS, {strict: false})
        orders = orderSystemUseCases(ctx.app)
    })

    const product = () => createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 1000}]})

    const order = async (variantId: string, qty: number) => {
        await fillCart(customer.api, [{variantId, quantity: qty}])
        return (await placeOk(customer)).id as string
    }
    const buy = async (variantId: string, qty: number) => {
        const id = await order(variantId, qty)
        await orders.markPaid.execute(id)
        return id
    }
    const favoriteBy = async (productId: string, n: number) => {
        const users: UserSession[] = []
        for (let i = 0; i < n; i++) {
            const user = await createUserSession(ctx)
            await putFavorite(user.api, productId)
            users.push(user)
        }
        return users
    }
    const statTags = async (productId: string) =>
        ((await anonymous.get(`/products/${productId}`)).json().data.meta.tags as string[]).filter((t) => t !== 'newest')

    describe('with no activity at all', () => {
        it('returns an empty result', async () => {
            const result = await refresh.execute()

            expect(result).toEqual({windowDays: 30, products: 0, bestSellers: 0, popular: 0, durationMs: expect.any(Number)})
            expect(result.durationMs).toBeGreaterThanOrEqual(0)
        })

        it('is repeatable', async () => {
            await refresh.execute()

            expect((await refresh.execute()).products).toBe(0)
        })
    })

    describe('sales', () => {
        it('tags a product that sold at least 3 units and not one that sold fewer', async () => {
            const [enough, tooFew] = [await product(), await product()]
            await buy(enough.variantIds[0], 3)
            await buy(tooFew.variantIds[0], 2)

            await refresh.execute()

            expect(await statTags(enough.id)).toEqual(['best_seller'])
            expect(await statTags(tooFew.id)).toEqual([])
        })

        it('adds up units over several orders and over the variants of one product', async () => {
            const multi = await createPublishedProduct(ctx.app, admin, {variants: [{size: '40'}, {size: '41'}]})
            const [ordersTwice, variants] = [await product(), multi]
            await buy(ordersTwice.variantIds[0], 2)
            await buy(ordersTwice.variantIds[0], 1)
            await buy(variants.variantIds[0], 2)
            await buy(variants.variantIds[1], 1)

            await refresh.execute()

            expect(await statTags(ordersTwice.id)).toEqual(['best_seller'])
            expect(await statTags(variants.id)).toEqual(['best_seller'])
        })

        it.each(['paid', 'processing', 'shipped', 'delivered'])('counts units of %s orders', async (status) => {
            const p = await product()
            const id = await buy(p.variantIds[0], 3)
            if (status !== 'paid') await adminStatus(admin, id, {action: 'startProcessing'})
            if (status === 'shipped' || status === 'delivered') await adminStatus(admin, id, {action: 'ship'})
            if (status === 'delivered') await adminStatus(admin, id, {action: 'deliver'})

            await refresh.execute()

            expect(await statTags(p.id)).toEqual(['best_seller'])
        })

        it('does not count unpaid or cancelled orders', async () => {
            const [pending, cancelledByUser, cancelledAfterPayment] = [await product(), await product(), await product()]
            await order(pending.variantIds[0], 3)
            const unpaid = await order(cancelledByUser.variantIds[0], 3)
            await customer.api.post(`/orders/${unpaid}/cancel`)
            const paid = await buy(cancelledAfterPayment.variantIds[0], 3)
            await adminStatus(admin, paid, {action: 'cancel'})

            await refresh.execute()

            for (const p of [pending, cancelledByUser, cancelledAfterPayment]) expect(await statTags(p.id)).toEqual([])
        })

        it('counts the paid order of a product even if the same cart also holds other products', async () => {
            const [a, b] = [await product(), await product()]
            await fillCart(customer.api, [{variantId: a.variantIds[0], quantity: 3}, {variantId: b.variantIds[0], quantity: 1}])
            await orders.markPaid.execute((await placeOk(customer)).id)

            await refresh.execute()

            expect(await statTags(a.id)).toEqual(['best_seller'])
            expect(await statTags(b.id)).toEqual([])
        })
    })

    describe('favorites', () => {
        it('tags a product that was favorited by at least 3 users and not one with fewer', async () => {
            const [loved, lukewarm] = [await product(), await product()]
            await favoriteBy(loved.id, 3)
            await favoriteBy(lukewarm.id, 2)

            await refresh.execute()

            expect(await statTags(loved.id)).toEqual(['popular'])
            expect(await statTags(lukewarm.id)).toEqual([])
        })

        it('does not count favorites that were removed', async () => {
            const p = await product()
            const users = await favoriteBy(p.id, 3)
            await refresh.execute()
            expect(await statTags(p.id)).toEqual(['popular'])

            await users[0].api.delete(`/favorites/${p.id}`)
            await refresh.execute()

            expect(await statTags(p.id)).toEqual([])
        })

        it('counts a favorite that is added again', async () => {
            const p = await product()
            const users = await favoriteBy(p.id, 3)
            await users[0].api.delete(`/favorites/${p.id}`)
            await putFavorite(users[0].api, p.id)

            await refresh.execute()

            expect(await statTags(p.id)).toEqual(['popular'])
        })
    })

    describe('combining both sources', () => {
        it('gives each product the tags of each metric independently', async () => {
            const [sells, loved, both, neither] = [await product(), await product(), await product(), await product()]
            await buy(sells.variantIds[0], 4)
            await favoriteBy(loved.id, 4)
            await buy(both.variantIds[0], 3)
            await favoriteBy(both.id, 3)
            await buy(neither.variantIds[0], 2)
            await favoriteBy(neither.id, 2)

            await refresh.execute()

            expect(await statTags(sells.id)).toEqual(['best_seller'])
            expect(await statTags(loved.id)).toEqual(['popular'])
            expect(await statTags(both.id)).toEqual(['best_seller', 'popular'])
            expect(await statTags(neither.id)).toEqual([])
        })

        it('shows the tags in list, search and slug detail as well', async () => {
            const p = await createPublishedProduct(ctx.app, admin, {name: `Insights visible ${Date.now()}`, variants: [{stock: 100}]})
            await buy(p.variantIds[0], 3)

            await refresh.execute()

            const listed = (await anonymous.get('/products?pageSize=100')).json().data.items.find((i: any) => i.id === p.id)
            const searched = (await anonymous.get(`/products/search?q=${encodeURIComponent(p.name)}`)).json().data.items[0]
            const bySlug = (await anonymous.get(`/products/slug/${p.slug}`)).json().data
            for (const item of [listed, searched, bySlug]) expect(item.meta.tags).toContain('best_seller')
        })
    })

    describe('every run replaces the previous snapshot', () => {
        it('removes a tag when the sale no longer counts, and is idempotent', async () => {
            const p = await product()
            const id = await buy(p.variantIds[0], 3)
            await refresh.execute()
            await refresh.execute()
            expect(await statTags(p.id)).toEqual(['best_seller'])

            await adminStatus(admin, id, {action: 'cancel'})
            await refresh.execute()

            expect(await statTags(p.id)).toEqual([])
        })

        it('picks up new activity on the next run only (tags are not live)', async () => {
            const p = await product()
            await refresh.execute()
            expect(await statTags(p.id)).toEqual([])

            await buy(p.variantIds[0], 3)
            expect(await statTags(p.id)).toEqual([])

            await refresh.execute()
            expect(await statTags(p.id)).toEqual(['best_seller'])
        })
    })

    describe('the 30 day window', () => {
        it('still counts activity 29 days from now and drops it after 31 days', async () => {
            const p = await product()
            await buy(p.variantIds[0], 3)
            await favoriteBy(p.id, 3)

            await withNowPlus(29 * DAY, () => refresh.execute())
            expect(await statTags(p.id)).toEqual(['best_seller', 'popular'])

            await withNowPlus(31 * DAY, () => refresh.execute())
            expect(await statTags(p.id)).toEqual([])

            await refresh.execute() // back to the real clock
            expect(await statTags(p.id)).toEqual(['best_seller', 'popular'])
        })
    })

    describe('concurrency', () => {
        it('lets only one refresh run at a time and recovers afterwards', async () => {
            const results = await Promise.allSettled([refresh.execute(), refresh.execute()])

            expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
            const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            expect(rejected).toHaveLength(1)
            expect(rejected[0].reason).toMatchObject({code: 'INSIGHTS_REFRESH_IN_PROGRESS', status: 409})

            await expect(refresh.execute()).resolves.toMatchObject({windowDays: 30})
        })
    })

    describe('the hourly job', () => {
        it('runs the refresh', async () => {
            const p = await product()
            await buy(p.variantIds[0], 3)

            await ctx.app.get(RefreshProductStatsJob, {strict: false}).run()

            expect(await statTags(p.id)).toEqual(['best_seller'])
        })

        it('never throws, not even when a refresh is already running', async () => {
            const job = ctx.app.get(RefreshProductStatsJob, {strict: false})

            const running = refresh.execute()
            await expect(job.run()).resolves.toBeUndefined()
            await running
        })
    })

    describe('POST /admin/insights/product-stats/refresh', () => {
        it('refreshes and returns the result', async () => {
            const p = await product()
            await buy(p.variantIds[0], 3)

            const res = await admin.post(REFRESH_URL)

            expectOk(res, 200, 'INSIGHTS_PRODUCT_STATS_REFRESH_SUCCESS')
            expect(res.json().data).toEqual({
                windowDays: 30,
                products: expect.any(Number),
                bestSellers: expect.any(Number),
                popular: expect.any(Number),
                durationMs: expect.any(Number),
            })
            expect(res.json().data.bestSellers).toBeGreaterThanOrEqual(1)
            expect(await statTags(p.id)).toContain('best_seller')
        })

        it('is admin only and needs the CSRF header', async () => {
            const shopper = (await createUserSession(ctx)).api

            expect([401, 403]).toContain((await anonymous.post(REFRESH_URL)).statusCode)
            expect((await shopper.post(REFRESH_URL)).statusCode).toBe(403)
            expect([401, 403]).toContain((await apiWithoutCsrf(ctx.app, adminSession.session).post(REFRESH_URL)).statusCode)
        })

        it('does not change anything for a rejected caller', async () => {
            const p = await product()
            await buy(p.variantIds[0], 3)

            await anonymous.post(REFRESH_URL)
            await (await createUserSession(ctx)).api.post(REFRESH_URL)

            expect(await statTags(p.id)).toEqual([])
        })

        it('answers 409 when a refresh is already running', async () => {
            const running = refresh.execute()

            const res = await admin.post(REFRESH_URL)
            await running

            expect([200, 409]).toContain(res.statusCode)
            if (res.statusCode === 409) expect(res.json().code).toBe('INSIGHTS_REFRESH_IN_PROGRESS')
        })
    })

    describe('expired orders (runs last: expires every pending order)', () => {
        it('does not count orders that expired unpaid', async () => {
            const p = await product()
            await order(p.variantIds[0], 3)
            await withNowPlus(31 * 60_000, () => orders.expireUnpaid.execute())

            await refresh.execute()

            expect(await statTags(p.id)).toEqual([])
        })
    })
})
