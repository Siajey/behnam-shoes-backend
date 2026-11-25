import {beforeAll, describe, expect, it} from '@jest/globals'

import {IRefreshProductStats} from '@api/insights/application'
import {UserRole} from '@api/users/domain'
import {REFRESH_PRODUCT_STATS} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, UserSession, anonymousApi, createUserSession} from '../../util/test.util'
import {createCategory, createPublishedProduct} from '../product/product-test.util'
import {Customer, createCustomer, fillCart, orderSystemUseCases, placeOk} from '../order/order-test.util'
import {mergeFavorites} from '../favorites/favorites-test.util'
import {ensureShippingMethods} from "../shipping/shipping-test.util";

const COUNT = 11

describe('Insights: ranking rules (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let anonymous: Api
    let customer: Customer
    let refresh: IRefreshProductStats
    let orders: ReturnType<typeof orderSystemUseCases>
    let products: {id: string; variantIds: string[]}[]
    let weak: {id: string; variantIds: string[]}

    const units = (i: number) => i + 3
    const favorites = (i: number) => 13 - i

    const buy = async (variantId: string, qty: number) => {
        for (let left = qty; left > 0; left -= 10) {
            await fillCart(customer.api, [{variantId, quantity: Math.min(10, left)}])
            await orders.markPaid.execute((await placeOk(customer)).id)
        }
    }
    const statTags = async (productId: string) =>
        ((await anonymous.get(`/products/${productId}`)).json().data.meta.tags as string[]).filter((t) => t !== 'newest')

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        await ensureShippingMethods(admin)
        anonymous = anonymousApi(ctx.app)
        customer = await createCustomer(ctx)
        refresh = ctx.app.get<IRefreshProductStats>(REFRESH_PRODUCT_STATS, {strict: false})
        orders = orderSystemUseCases(ctx.app)

        const category = await createCategory(admin)
        products = []
        for (let i = 0; i < COUNT; i++) {
            products.push(await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{stock: 1000}]}))
        }
        weak = await createPublishedProduct(ctx.app, admin, {categoryId: category.id, variants: [{stock: 1000}]})

        for (let i = 0; i < COUNT; i++) await buy(products[i].variantIds[0], units(i))
        await buy(weak.variantIds[0], 2)


        const users: UserSession[] = []
        for (let j = 0; j < 13; j++) users.push(await createUserSession(ctx))
        for (let j = 0; j < 13; j++) {
            const wanted = products.filter((_, i) => favorites(i) > j).map((p) => p.id)
            if (wanted.length) expect((await mergeFavorites(users[j].api, wanted)).statusCode).toBe(200)
        }
        await mergeFavorites(users[0].api, [weak.id])
        await mergeFavorites(users[1].api, [weak.id])
    },30_000)

    it('flags the top 10 of each metric and counts every product that has activity', async () => {
        const result = await refresh.execute()

        expect(result).toEqual({windowDays: 30, products: 12, bestSellers: 10, popular: 10, durationMs: expect.any(Number)})
    })

    it('ranks the two metrics independently', async () => {
        await refresh.execute()

        expect(await statTags(products[0].id)).toEqual(['popular'])
        expect(await statTags(products[COUNT - 1].id)).toEqual(['best_seller'])
        for (const p of products.slice(1, COUNT - 1)) expect(await statTags(p.id)).toEqual(['best_seller', 'popular'])
    })

    it('never tags a product below the minimums, even when there is room in the top 10', async () => {
        await refresh.execute()

        expect(await statTags(weak.id)).toEqual([])
    })

    it('gives the same snapshot on every run', async () => {
        await refresh.execute()
        const first = await Promise.all(products.map((p) => statTags(p.id)))

        const result = await refresh.execute()

        expect(await Promise.all(products.map((p) => statTags(p.id)))).toEqual(first)
        expect(result).toMatchObject({products: 12, bestSellers: 10, popular: 10})
    })

    it('moves the cut-off when a ranking changes', async () => {
        await refresh.execute()
        expect(await statTags(products[0].id)).toEqual(['popular'])

        await buy(products[0].variantIds[0], 20)
        await refresh.execute()

        expect(await statTags(products[0].id)).toEqual(['best_seller', 'popular'])
        expect(await statTags(products[1].id)).toEqual(['popular'])
    })
})
