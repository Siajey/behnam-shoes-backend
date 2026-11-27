import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, expectError, expectValidationError} from '../../util/test.util'
import {fakeShippingCarrier as carrier} from '../../util/fake-shipping-carrier'
import {createPublishedProduct} from '../product/product-test.util'
import {getCart} from '../cart/cart-test.util'
import {createCoupon} from '../discount/discount-test.util'
import {Customer, createCustomer, fillCart, getAdminOrder, getOrder, newKey, orderSystemUseCases, placeOk, placeOrder} from './order-test.util'
import {
    addAddress,
    ensureShippingMethods,
    methodTracker,
    rateFor,
    AZARBAIJAN_GHARBI, MAHABAD
} from '../shipping/shipping-test.util'

describe('Orders: shipping method and fee (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let methods: ReturnType<typeof methodTracker>
    let customer: Customer
    let azerbaijanAddress: string
    let variantId: string
    let orders: ReturnType<typeof orderSystemUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        methods = methodTracker(admin)
        orders = orderSystemUseCases(ctx.app)
        await ensureShippingMethods(admin)
        variantId = (await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 100000}]})).variantIds[0]
        customer = await createCustomer(ctx)
        azerbaijanAddress = await addAddress(customer, AZARBAIJAN_GHARBI, MAHABAD)
    })

    afterEach(async () => {
        carrier.reset()
        await methods.cleanup()
    })

    const cartOf = async (units: number) => {
        await customer.api.delete('/cart')
        await fillCart(customer.api, [{variantId, quantity: units}])
    }
    const orderCount = async () => ((await customer.api.get('/orders?pageSize=100')).json().data.items as any[]).length
    const optionFee = async (code: string, addressId = customer.addressId) =>
        ((await customer.api.get(`/shipping/options?addressId=${addressId}`)).json().data.options as any[]).find((o) => o.methodCode === code)?.fee
    const usage = async (couponId: string) => (await admin.get(`/admin/coupons/${couponId}/usage`)).json().data

    describe('the fee and the totals', () => {
        it('uses the rate table price of the chosen method and adds it to the total', async () => {
            await cartOf(2)

            const post = await placeOk(customer, {shippingMethod: 'post'})
            const express = await placeOk(customer, {shippingMethod: 'express'})

            expect(post.totals).toMatchObject({subtotal: 2000, shippingFee: rateFor('post', 2), total: 2000 + rateFor('post', 2)})
            expect(express.totals).toMatchObject({shippingFee: rateFor('express', 2), total: 2000 + rateFor('express', 2)})
            expect(post.total).toBe(post.totals.total)
        })

        it('prices by the number of units and by the destination province', async () => {
            await cartOf(1)
            const far = await placeOk(customer, {shippingMethod: 'post'})
            const near = await placeOk(customer, {shippingMethod: 'post', addressId: azerbaijanAddress})
            expect(far.totals.shippingFee).toBe(rateFor('post', 1))
            expect(near.totals.shippingFee).toBe(rateFor('post', 1, true))
            expect(near.totals.shippingFee).toBeLessThan(far.totals.shippingFee)
            expect(near.shippingAddress).toMatchObject({province: AZARBAIJAN_GHARBI})
        })

        it('adds the handling fee of the method', async () => {
            await cartOf(1)
            const method = await methods.create({service: 'post', handlingFee: 5000})

            const order = await placeOk(customer, {shippingMethod: method.code})

            expect(order.totals.shippingFee).toBe(rateFor('post', 1, false, 5000))
        })

        it('quotes exactly what /shipping/options showed for the same cart, address and method', async () => {
            await cartOf(3)
            const custom = await methods.create({service: 'express', handlingFee: 1234, name: 'Custom'})

            for (const code of ['post', 'express', custom.code]) {
                const order = await placeOk(customer, {shippingMethod: code})
                expect(order.totals.shippingFee).toBe(await optionFee(code))
            }
        })

        it('computes total = subtotal - product discounts - coupon + shipping', async () => {
            await cartOf(2)
            const coupon = await createCoupon(admin, {value: 10})
            await customer.api.put('/cart/coupon', {code: coupon.code})

            const order = await placeOk(customer)

            const t = order.totals
            expect(t.couponDiscount).toBe(200)
            expect(t.total).toBe(t.subtotal - t.productDiscountTotal - t.couponDiscount + t.shippingFee)
        })

        it('ignores a fee sent by the client', async () => {
            await cartOf(1)

            const order = await placeOk(customer, {shippingFee: 0, totals: {shippingFee: 0}})

            expect(order.totals.shippingFee).toBe(rateFor('post', 1))
        })

        it('is what the payment module charges', async () => {
            await cartOf(2)
            const order = await placeOk(customer)

            const info = await orders.getPaymentInfo.execute(order.id)

            expect(info.amount).toBe(order.total)
        })
    })

    describe('when the carrier cannot price', () => {
        it('uses the fallback fee of the method (without the handling fee)', async () => {
            await cartOf(1)
            carrier.failQuotes()
            const method = await methods.create({carrier: 'fake', service: 'svc', fallbackFee: 88000, handlingFee: 5000})

            const order = await placeOk(customer, {shippingMethod: method.code})

            expect(order.totals.shippingFee).toBe(88000)
        })

        it('uses the fallback fee when the rate table has no entry for the service', async () => {
            await cartOf(1)
            const method = await methods.create({service: 'unknown_service', fallbackFee: 77000})

            expect((await placeOk(customer, {shippingMethod: method.code})).totals.shippingFee).toBe(77000)
        })

        it('answers 409 SHIPPING_QUOTE_UNAVAILABLE without a fallback, and touches neither the coupon nor the cart', async () => {
            await cartOf(2)
            carrier.failQuotes()
            const method = await methods.create({carrier: 'fake', service: 'svc'})
            const coupon = await createCoupon(admin, {value: 10})
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const before = await orderCount()
            expectError(await placeOrder(customer, {shippingMethod: method.code}), 409, 'SHIPPING_QUOTE_UNAVAILABLE') // returns 201 respnose

            expect(await orderCount()).toBe(before)
            expect((await usage(coupon.id)).reserved).toBe(0)
            expect((await getCart(customer.api)).items[0].quantity).toBe(2)
        })

        it('does not hide our own errors behind a fallback', async () => {
            await cartOf(1)
            carrier.crashQuotes()
            const method = await methods.create({carrier: 'fake', service: 'svc', fallbackFee: 88000})

            expect((await placeOrder(customer, {shippingMethod: method.code})).statusCode).toBeGreaterThanOrEqual(500)
        })
    })

    describe('free shipping', () => {
        it('is free when the total after discounts and the coupon reaches the method threshold', async () => {
            await cartOf(3)
            const method = await methods.create({service: 'post', freeThreshold: 3000})

            const order = await placeOk(customer, {shippingMethod: method.code})

            expect(order.totals).toMatchObject({subtotal: 3000, shippingFee: 0, total: 3000})
        })

        it('is charged again when a coupon brings the total under the threshold', async () => {
            await cartOf(3)
            const method = await methods.create({service: 'post', freeThreshold: 3000})
            const coupon = await createCoupon(admin, {kind: 'fixed', value: 100})
            await customer.api.put('/cart/coupon', {code: coupon.code})

            const order = await placeOk(customer, {shippingMethod: method.code})

            expect(order.totals.shippingFee).toBe(rateFor('post', 3))
        })

        it('is decided per method', async () => {
            await cartOf(3)
            const free = await methods.create({service: 'post', freeThreshold: 3000})

            expect((await placeOk(customer, {shippingMethod: free.code})).totals.shippingFee).toBe(0)
            expect((await placeOk(customer, {shippingMethod: 'post'})).totals.shippingFee).toBe(rateFor('post', 3))
        })
    })

    describe('methods that use other carriers', () => {
        it.each([
            ['tipax', 'express'],
            ['iran_post', 'post'],
        ] as const)('prices a %s method (service %s) from the rate table', async (carrierName, service) => {
            await cartOf(2)
            const method = await methods.create({carrier: carrierName, service, name: `Via ${carrierName}`})

            const order = await placeOk(customer, {shippingMethod: method.code})

            expect(order.totals.shippingFee).toBe(rateFor(service, 2))
            expect(order.shippingMethod).toEqual({code: method.code, name: `Via ${carrierName}`})
        })

        it('asks a pricing carrier with the destination, the parcel and the declared value', async () => {
            await cartOf(2)
            carrier.respondWith(64000)
            const method = await methods.create({carrier: 'fake', service: 'svc', handlingFee: 1000})

            const order = await placeOk(customer, {shippingMethod: method.code})

            expect(order.totals.shippingFee).toBe(65000)
            expect(carrier.quoteRequests).toEqual([
                {
                    service: 'svc',
                    origin: {postalCode: '1234567890', province: AZARBAIJAN_GHARBI, city: MAHABAD},
                    destination: {postalCode: '1234567899', province: 'Tehran', city: 'Tehran'},
                    parcel: {weightGrams: 2 * 1500 + 500, declaredValue: 2000},
                },
            ])
        })
    })

    describe('the method snapshot', () => {
        it('is shown in the place response, the order detail and the admin detail', async () => {
            await cartOf(1)
            const method = await methods.create({service: 'post', name: 'Snapshot post'})

            const placed = await placeOk(customer, {shippingMethod: method.code})

            const expected = {code: method.code, name: 'Snapshot post'}
            expect(placed.shippingMethod).toEqual(expected)
            expect((await getOrder(customer.api, placed.id)).shippingMethod).toEqual(expected)
            expect((await getAdminOrder(admin, placed.id)).shippingMethod).toEqual(expected)
        })

        it('is not part of the order list summaries', async () => {
            await cartOf(1)
            await placeOk(customer)

            const [summary] = (await customer.api.get('/orders')).json().data.items

            expect(summary).not.toHaveProperty('shippingMethod')
        })

        it('does not change when the method is renamed, repriced, deactivated or deleted, and the order stays payable', async () => {
            await cartOf(1)
            const method = await methods.create({service: 'post', name: 'Original'})
            const placed = await placeOk(customer, {shippingMethod: method.code})

            await admin.patch(`/admin/shipping-methods/${method.id}`, {name: 'Renamed', handlingFee: 99999, service: 'express'})
            await admin.patch(`/admin/shipping-methods/${method.id}`, {isActive: false})
            await admin.delete(`/admin/shipping-methods/${method.id}`)

            const stored = await getOrder(customer.api, placed.id)
            expect(stored.shippingMethod).toEqual({code: method.code, name: 'Original'})
            expect(stored.totals).toEqual(placed.totals)
            await expect(orders.getPayable.execute(placed.id, customer.userId)).resolves.toMatchObject({amount: placed.total})
        })

        it('is returned unchanged when the same idempotency key is replayed after the method changed', async () => {
            await cartOf(1)
            const method = await methods.create({service: 'post', name: 'Before'})
            const key = newKey()
            const first = await placeOk(customer, {shippingMethod: method.code}, key)
            await admin.patch(`/admin/shipping-methods/${method.id}`, {name: 'After', handlingFee: 7777})

            const replay = await placeOrder(customer, {shippingMethod: method.code}, key)

            expect(replay.statusCode).toBe(201)
            expect(replay.json().data.shippingMethod).toEqual({code: method.code, name: 'Before'})
            expect(replay.json().data.total).toBe(first.total)
        })
    })

    describe('expectedTotal includes shipping', () => {
        it('is accepted when it matches cart total plus the shipping option', async () => {
            await cartOf(2)
            const cart = (await getCart(customer.api)).totals.total
            const shown = cart + (await optionFee('post'))

            expect((await placeOrder(customer, {expectedTotal: shown})).statusCode).toBe(201)
        })

        it('rejects a total seen before the shipping price changed, and accepts the new one', async () => {
            await cartOf(2)
            const method = await methods.create({service: 'post'})
            const seen = (await getCart(customer.api)).totals.total + (await optionFee(method.code))
            await admin.patch(`/admin/shipping-methods/${method.id}`, {handlingFee: 10000})

            expectError(await placeOrder(customer, {shippingMethod: method.code, expectedTotal: seen}), 409, 'ORDER_PRICE_CHANGED')
            expect((await placeOrder(customer, {shippingMethod: method.code, expectedTotal: seen + 10000})).statusCode).toBe(201)
        })

        it('does not accept the total of another method', async () => {
            await cartOf(1)
            const postTotal = (await getCart(customer.api)).totals.total + (await optionFee('post'))

            expectError(await placeOrder(customer, {shippingMethod: 'express', expectedTotal: postTotal}), 409, 'ORDER_PRICE_CHANGED')
        })
    })

    describe('methods that cannot be used', () => {
        it('rejects an unknown or inactive method and creates nothing', async () => {
            await cartOf(1)
            const inactive = await methods.create({isActive: false})
            const before = await orderCount()

            expectError(await placeOrder(customer, {shippingMethod: 'no_such_method'}), 404, 'SHIPPING_METHOD_NOT_FOUND')
            expectError(await placeOrder(customer, {shippingMethod: inactive.code}), 404, 'SHIPPING_METHOD_NOT_FOUND')

            expect(await orderCount()).toBe(before)
            expect((await getCart(customer.api)).items).toHaveLength(1)
        })

        it('rejects a method that was deleted', async () => {
            await cartOf(1)
            const method = await methods.create()
            await admin.delete(`/admin/shipping-methods/${method.id}`)

            expectError(await placeOrder(customer, {shippingMethod: method.code}), 404, 'SHIPPING_METHOD_NOT_FOUND')
        })

        it.each([
            ['a missing method', undefined],
            ['an empty method', ''],
            ['an upper-case code', 'Post'],
            ['a code starting with a digit', '1post'],
            ['a one-character code', 'p'],
            ['a code with a dash', 'my-code'],
            ['a code over 30 characters', `a${'b'.repeat(30)}`],
            ['a numeric code', 12],
        ])('rejects %s', async (_label, shippingMethod) => {
            await cartOf(1)

            expectValidationError(await placeOrder(customer, {shippingMethod}))
        })

        it('trims the code', async () => {
            await cartOf(1)

            expect((await placeOrder(customer, {shippingMethod: '  post  '})).statusCode).toBe(201)
        })
    })

    describe('other checkout failures leave the coupon alone', () => {
        it('does not reserve the coupon when the shipping method is unknown', async () => {
            await cartOf(1)
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})

            await placeOrder(customer, {shippingMethod: 'no_such_method'})

            expect((await usage(coupon.id)).reserved).toBe(0)
        })
    })
})