import {beforeAll, describe, expect, it} from '@jest/globals'

import {IHasPurchasedProduct} from '@api/order/application'
import {IUpsertProductRating} from '@api/product/application'
import {UserRole} from '@api/users/domain'
import {HAS_PURCHASED_PRODUCT, UPSERT_PRODUCT_RATING} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, anonymousApi, createUserSession, qs, randomId} from '../../util/test.util'
import {createCategory, createPublishedProduct} from '../product/product-test.util'
import {Customer, adminStatus, createCustomer, fillCart, orderSystemUseCases, placeOk} from '../order/order-test.util'
import {ensureShippingMethods} from '../shipping/shipping-test.util'
import {OrderState, buyer} from './review-test.util'

describe('Reviews: system contracts (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let hasPurchased: IHasPurchasedProduct
    let upsertRating: IUpsertProductRating
    let categoryId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        await ensureShippingMethods(admin)
        hasPurchased = ctx.app.get<IHasPurchasedProduct>(HAS_PURCHASED_PRODUCT, {strict: false})
        upsertRating = ctx.app.get<IUpsertProductRating>(UPSERT_PRODUCT_RATING, {strict: false})
        categoryId = (await createCategory(admin)).id
    })

    const product = () => createPublishedProduct(ctx.app, admin, {categoryId, variants: [{price: 1000, stock: 100000}]})

    describe('HasPurchasedProduct (order module)', () => {
        it.each([
            ['pending_payment', false],
            ['paid', false],
            ['processing', false],
            ['cancelled', false],
            ['shipped', true],
            ['delivered', true],
        ] as [OrderState, boolean][])('is %s for an order that is %s', async (state, expected) => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0], state)

            expect(await hasPurchased.execute(user.userId, p.id)).toBe(expected)
        })

        it('is specific to the user and to the product', async () => {
            const [a, b] = [await product(), await product()]
            const user = await buyer(ctx, admin, a.variantIds[0])
            const other = await createUserSession(ctx)

            expect(await hasPurchased.execute(user.userId, a.id)).toBe(true)
            expect(await hasPurchased.execute(user.userId, b.id)).toBe(false)
            expect(await hasPurchased.execute(other.userId, a.id)).toBe(false)
            expect(await hasPurchased.execute(user.userId, randomId())).toBe(false)
        })

        it('finds the product among several lines of one order', async () => {
            const [a, b] = [await product(), await product()]
            const customer: Customer = await createCustomer(ctx)
            await fillCart(customer.api, [{variantId: a.variantIds[0]}, {variantId: b.variantIds[0]}])
            const order = await placeOk(customer)
            await orderSystemUseCases(ctx.app).markPaid.execute(order.id)
            await adminStatus(admin, order.id, {action: 'startProcessing'})
            await adminStatus(admin, order.id, {action: 'ship'})

            expect(await hasPurchased.execute(customer.userId, a.id)).toBe(true)
            expect(await hasPurchased.execute(customer.userId, b.id)).toBe(true)
        })

        it('is true for a user with several orders as soon as one is shipped', async () => {
            const p = await product()
            const user = await buyer(ctx, admin, p.variantIds[0], 'paid')
            expect(await hasPurchased.execute(user.userId, p.id)).toBe(false)

            await fillCart(user.api, [{variantId: p.variantIds[0]}])
            const second = await placeOk(user)
            await orderSystemUseCases(ctx.app).markPaid.execute(second.id)
            await adminStatus(admin, second.id, {action: 'startProcessing'})
            await adminStatus(admin, second.id, {action: 'ship'})

            expect(await hasPurchased.execute(user.userId, p.id)).toBe(true)
        })
    })

    describe('UpsertProductRating (product module)', () => {
        const anonymous = () => anonymousApi(ctx.app)
        const ratingOf = async (id: string) => (await anonymous().get(`/products/${id}`)).json().data.meta.rating

        it('shows the rating in the detail, the list and the search', async () => {
            const p = await createPublishedProduct(ctx.app, admin, {categoryId, name: `System rating ${randomId().slice(0, 8)}`, variants: [{}]})

            await upsertRating.execute({productId: p.id, average: 4.5, count: 12})

            expect(await ratingOf(p.id)).toEqual({average: 4.5, count: 12})
            const listed = (await anonymous().get('/products?pageSize=100')).json().data.items.find((i: any) => i.id === p.id)
            const found = (await anonymous().get(`/products/search${qs({q: p.name})}`)).json().data.items[0]
            expect(listed.meta.rating).toEqual({average: 4.5, count: 12})
            expect(found.meta.rating).toEqual({average: 4.5, count: 12})
        })

        it('replaces the previous value, and a count of 0 removes the rating', async () => {
            const p = await product()
            await upsertRating.execute({productId: p.id, average: 3.2, count: 5})
            await upsertRating.execute({productId: p.id, average: 4.1, count: 9})
            expect(await ratingOf(p.id)).toEqual({average: 4.1, count: 9})

            await upsertRating.execute({productId: p.id, average: 4.1, count: 0})

            expect(await ratingOf(p.id)).toEqual({average: 0, count: 0})
        })

        it('keeps products independent and has no rating by default', async () => {
            const [a, b, none] = [await product(), await product(), await product()]

            await upsertRating.execute({productId: a.id, average: 5, count: 1})
            await upsertRating.execute({productId: b.id, average: 2.5, count: 4})

            expect(await ratingOf(a.id)).toEqual({average: 5, count: 1})
            expect(await ratingOf(b.id)).toEqual({average: 2.5, count: 4})
            expect(await ratingOf(none.id)).toEqual({average: 0, count: 0})
        })

        it('ignores a product that does not exist and removing a rating that was never set', async () => {
            await expect(upsertRating.execute({productId: randomId(), average: 5, count: 3})).resolves.toBeUndefined()
            await expect(upsertRating.execute({productId: randomId(), average: 0, count: 0})).resolves.toBeUndefined()
        })

        it('keeps one decimal', async () => {
            const p = await product()

            await upsertRating.execute({productId: p.id, average: 4.3, count: 3})

            expect((await ratingOf(p.id)).average).toBe(4.3)
        })
    })
})
