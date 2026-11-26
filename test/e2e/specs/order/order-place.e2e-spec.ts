import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    sleep,
} from '../../util/test.util'
import {changeVariant, createPublishedProduct, imageKeyOf} from '../product/product-test.util'
import {getCart} from '../cart/cart-test.util'
import {createCoupon, discountTracker, scope} from '../discount/discount-test.util'
import {
    ADDRESS,
    createCustomer,
    CURRENCY,
    fillCart,
    getOrder,
    newKey,
    PAYMENT_WINDOW_MS,
    placeOk,
    placeOrder,
    PROFILE,
} from './order-test.util'
import {cdnUrl} from "../../util/fake-file-storage";
import {ensureShippingMethods, rateFor} from "../shipping/shipping-test.util";

describe('Orders: placing an order (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let discounts: ReturnType<typeof discountTracker>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        await ensureShippingMethods(admin)
        discounts = discountTracker(admin)
    })

    const product = (price = 1000, stock = 50) =>
        createPublishedProduct(ctx.app, admin, {variants: [{price, stock}]})

    const ordersOf = async (customer: { api: Api }) =>
        (await customer.api.get('/orders')).json().data.items as any[]

    const couponUsage = async (couponId: string) =>
        (await admin.get(`/admin/coupons/${couponId}/usage`)).json().data

    /** A customer whose cart holds `quantity` of a fresh product priced `price`. */
    const shopper = async (price = 1000, quantity = 2) => {
        const p = await product(price)
        const customer = await createCustomer(ctx)
        await fillCart(customer.api, [{variantId: p.variantIds[0], quantity}])
        return {p, customer}
    }

    describe('a successful order', () => {
        it('creates a pending_payment order with the full detail shape', async () => {
            const {p, customer} = await shopper(1000, 2)

            const res = await placeOrder(customer)
            expectOk(res, 201, 'ORDER_PLACE_SUCCESS')
            const fee = rateFor('post', 2)
            expect(res.json().data).toEqual({
                id: expect.any(String),
                orderNumber: expect.any(Number),
                status: 'pending_payment',
                itemCount: 2,
                total: 2000 + fee,
                currency: CURRENCY,
                previewImageKey: imageKeyOf(p.id),
                previewImageUrl: cdnUrl(imageKeyOf(p.id)),
                createdAt: expect.any(String),
                paidAt: null,
                tracking: null,
                totals: {
                    subtotal: 2000,
                    productDiscountTotal: 0,
                    couponDiscount: 0,
                    shippingFee: fee,
                    total: 2000 + fee
                },
                coupon: null,
                lines: [
                    {
                        variantId: p.variantIds[0],
                        productId: p.id,
                        productName: p.name,
                        productSlug: p.slug,
                        imageKey: imageKeyOf(p.id),
                        imageUrl: cdnUrl(imageKeyOf(p.id)),
                        attributes: expect.arrayContaining([
                            {name: 'size', value: '42'},
                            {name: 'color', value: 'black'},
                        ]),
                        quantity: 2,
                        originalUnitPrice: 1000,
                        unitPrice: 1000,
                        couponAllocation: 0,
                        lineTotal: 2000,
                    },
                ],
                shippingAddress: ADDRESS,
                recipient: {...PROFILE, phoneNumber: expect.stringMatching(/^09\d{9}$/)},
                shipment: {carrier: null, trackingCode: null},
                canPay: true,
                expiresAt: expect.any(String),
                shippingMethod: {
                    code: "post",
                    name: "Post",
                },
                timeline: [{status: 'pending_payment', note: null, at: expect.any(String)}],
            })
        })

        it('does not expose internal line fields to the customer', async () => {
            const {customer} = await shopper()

            const order = await placeOk(customer)

            expect(order.lines[0]).not.toHaveProperty('sku')
            expect(order.lines[0]).not.toHaveProperty('externalId')
            expect(order).not.toHaveProperty('userId')
        })

        it('gives the customer 30 minutes to pay', async () => {
            const {customer} = await shopper()

            const order = await placeOk(customer)

            expect(new Date(order.expiresAt).getTime() - new Date(order.createdAt).getTime()).toBe(PAYMENT_WINDOW_MS)
        })

        it('keeps the cart until the order is paid', async () => {
            const {customer} = await shopper(1000, 3)

            await placeOk(customer)

            expect((await getCart(customer.api)).items).toHaveLength(1)
        })

        it('is returned by GET /orders/:id exactly as it was placed', async () => {
            const {customer} = await shopper()

            const placed = await placeOk(customer)

            expect(await getOrder(customer.api, placed.id)).toEqual(placed)
        })

        it('numbers orders in increasing order', async () => {
            const {customer} = await shopper()

            const first = await placeOk(customer)
            const second = await placeOk(customer)

            expect(first.orderNumber).toBeGreaterThan(0)
            expect(second.orderNumber).toBeGreaterThan(first.orderNumber)
        })

        it('keeps the cart line order and snapshots every line', async () => {
            const [a, b] = [await product(1000), await product(2500)]
            const customer = await createCustomer(ctx)
            await fillCart(customer.api, [{variantId: a.variantIds[0]}, {variantId: b.variantIds[0], quantity: 3}])

            const order = await placeOk(customer)

            expect(order.lines.map((l: any) => [l.variantId, l.quantity, l.lineTotal])).toEqual([
                [a.variantIds[0], 1, 1000],
                [b.variantIds[0], 3, 7500],
            ])
            expect(order.itemCount).toBe(4)
            expect(order.totals.subtotal).toBe(8500)
        })

        it('is a snapshot: later catalog and address changes do not alter it', async () => {
            const {p, customer} = await shopper(1000, 1)
            const placed = await placeOk(customer)

            await admin.patch(`/admin/products/${p.id}`, {name: 'Renamed later'})
            await changeVariant(ctx.app, p.variants[0], {price: 5000})
            const patch = await customer.api.patch(`/users/me/addresses/${customer.addressId}`, {city: 'Isfahan'})
            expect(patch.statusCode).toBe(200)

            const stored = await getOrder(customer.api, placed.id)
            expect(stored.lines[0]).toMatchObject({productName: p.name, unitPrice: 1000})
            expect(stored.shippingAddress).toEqual(ADDRESS)
            expect(stored.totals.total).toBe(placed.totals.total)
        })
    })

    describe('prices, discounts and coupons', () => {
        it('uses discounted prices and spreads the coupon over the lines', async () => {
            const p = await product(1000)
            await discounts.create({value: 10, scope: scope('variant', p.variantIds[0])})
            const coupon = await createCoupon(admin, {value: 10, applyToDiscountedItems: true})
            const customer = await createCustomer(ctx)
            await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 2}])
            expect((await customer.api.put('/cart/coupon', {code: coupon.code})).statusCode).toBe(200)

            const order = await placeOk(customer)

            const fee = rateFor('post', 2)
            expect(order.totals).toEqual({
                subtotal: 2000,
                productDiscountTotal: 200,
                couponDiscount: 180,
                shippingFee: fee,
                total: 2000 - 200 - 180 + fee,
            })
            expect(order.coupon).toEqual({code: coupon.code})
            expect(order.lines[0]).toMatchObject({
                originalUnitPrice: 1000,
                unitPrice: 900,
                couponAllocation: 180,
                lineTotal: 1620
            })
            await discounts.cleanup()
        })

        it('reserves the coupon for the order', async () => {
            const {customer} = await shopper(1000, 1)
            const coupon = await createCoupon(admin, {value: 10})
            await customer.api.put('/cart/coupon', {code: coupon.code})

            await placeOk(customer)

            expect(await couponUsage(coupon.id)).toEqual({reserved: 1, committed: 0, released: 0, totalDiscount: 100})
        })

        it('is blocked while the cart coupon is invalid and creates nothing', async () => {
            const {customer} = await shopper()
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})
            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})

            expectError(await placeOrder(customer), 409, 'CART_CHECKOUT_BLOCKED')

            expect(await ordersOf(customer)).toEqual([])
            expect((await couponUsage(coupon.id)).reserved).toBe(0)
        })

        it('lets only one of two parallel orders use the last coupon slot', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            const p = await product(1000)
            const [one, two] = [await createCustomer(ctx), await createCustomer(ctx)]
            for (const c of [one, two]) {
                await fillCart(c.api, [{variantId: p.variantIds[0]}])
                expect((await c.api.put('/cart/coupon', {code: coupon.code})).statusCode).toBe(200)
            }

            const results = await Promise.all([placeOrder(one), placeOrder(two)])

            expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409])
            const failed = results.find((r) => r.statusCode === 409)!
            expect(['COUPON_LIMIT_REACHED', 'CART_CHECKOUT_BLOCKED']).toContain(failed.json().code)
            expect((await couponUsage(coupon.id)).reserved).toBe(1)
            expect((await ordersOf(one)).length + (await ordersOf(two)).length).toBe(1)
        })
    })

    describe('idempotency', () => {
        it('returns the same order for the same key without creating another', async () => {
            const {customer} = await shopper()
            const key = newKey()

            const first = await placeOrder(customer, {}, key)
            const second = await placeOrder(customer, {}, key)

            expect([first.statusCode, second.statusCode]).toEqual([201, 201])
            expect(second.json().data).toEqual(first.json().data)
            expect(await ordersOf(customer)).toHaveLength(1)
        })

        it('replays the original order even after the cart changed', async () => {
            const {p, customer} = await shopper(1000, 2)
            const key = newKey()
            const first = await placeOk(customer, {}, key)
            await customer.api.delete(`/cart/items/${p.variantIds[0]}`)

            const replay = await placeOrder(customer, {}, key)

            expect(replay.statusCode).toBe(201)
            expect(replay.json().data.id).toBe(first.id)
            expect(replay.json().data.itemCount).toBe(2)
        })

        it('does not reserve the coupon twice on replay', async () => {
            const {customer} = await shopper(1000, 1)
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const key = newKey()

            await placeOk(customer, {}, key)
            await placeOk(customer, {}, key)

            expect((await couponUsage(coupon.id)).reserved).toBe(1)
        })

        it('treats different keys as different orders', async () => {
            const {customer} = await shopper()

            const [a, b] = [await placeOk(customer), await placeOk(customer)]

            expect(a.id).not.toBe(b.id)
            expect(await ordersOf(customer)).toHaveLength(2)
        })

        it('scopes keys to the user', async () => {
            const p = await product()
            const [one, two] = [await createCustomer(ctx), await createCustomer(ctx)]
            await fillCart(one.api, [{variantId: p.variantIds[0]}])
            await fillCart(two.api, [{variantId: p.variantIds[0]}])
            const key = newKey()

            const [a, b] = [await placeOk(one, {}, key), await placeOk(two, {}, key)]

            expect(a.id).not.toBe(b.id)
        })

        it('creates a single order for parallel requests with the same key', async () => {
            const {customer} = await shopper()
            const key = newKey()

            const results = await Promise.all([placeOrder(customer, {}, key), placeOrder(customer, {}, key)])

            expect(results.map((r) => r.statusCode)).toEqual([201, 201])
            expect(results[0].json().data.id).toBe(results[1].json().data.id)
            expect(await ordersOf(customer)).toHaveLength(1)
        })

        it('does not reserve the coupon twice for parallel requests with the same key', async () => {
            const {customer} = await shopper(1000, 1)
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const key = newKey()

            await Promise.all([placeOrder(customer, {}, key), placeOrder(customer, {}, key)])
            await sleep(50)

            expect((await couponUsage(coupon.id)).reserved).toBe(1)
        })

        it.each([
            ['a missing header', null],
            ['a key shorter than 8 characters', 'a'.repeat(7)],
            ['a blank key', '        '],
            ['a key longer than 100 characters', 'a'.repeat(101)],
        ])('rejects %s', async (_label, key) => {
            const {customer} = await shopper()

            const res = await placeOrder(customer, {}, key)

            expect(res.statusCode).toBe(400)
            expect(['ORDER_INVALID_IDEMPOTENCY_KEY', 'VALIDATION_ERROR']).toContain(res.json().code)
            expect(await ordersOf(customer)).toEqual([])
        })

        it('accepts keys of exactly 8 and 100 characters and trims whitespace', async () => {
            const {customer} = await shopper()

            expect((await placeOrder(customer, {}, 'k'.repeat(8))).statusCode).toBe(201)
            expect((await placeOrder(customer, {}, 'k'.repeat(100))).statusCode).toBe(201)
            const trimmed = await placeOrder(customer, {}, `  ${'t'.repeat(8)}  `)
            const again = await placeOrder(customer, {}, 't'.repeat(8))
            expect(again.json().data.id).toBe(trimmed.json().data.id)
        })
    })

    describe('expectedTotal', () => {
        it('is accepted when it matches the order total', async () => {
            const {customer} = await shopper(1000, 2)
            const cart = await getCart(customer.api)

            const res = await placeOrder(customer, {expectedTotal: cart.totals.total + rateFor('post', 2)})

            expect(res.statusCode).toBe(201)
        })

        it('rejects a stale total with ORDER_PRICE_CHANGED and creates nothing', async () => {
            const {p, customer} = await shopper(1000, 1)
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const seen = (await getCart(customer.api)).totals.total + rateFor('post', 1)
            await changeVariant(ctx.app, p.variants[0], {price: 2000})

            expectError(await placeOrder(customer, {expectedTotal: seen}), 409, 'ORDER_PRICE_CHANGED')

            expect(await ordersOf(customer)).toEqual([])
            expect((await couponUsage(coupon.id)).reserved).toBe(0)
        })

        it('is optional: without it the current price is used', async () => {
            const {p, customer} = await shopper(1000, 1)
            await changeVariant(ctx.app, p.variants[0], {price: 2000})

            const order = await placeOk(customer)

            expect(order.totals.subtotal).toBe(2000)
        })
    })

    describe('failures', () => {
        it('rejects an empty cart', async () => {
            const customer = await createCustomer(ctx)

            expectError(await placeOrder(customer), 409, 'CART_CHECKOUT_BLOCKED')
            expect(await ordersOf(customer)).toEqual([])
        })

        it('rejects a cart with an unavailable line', async () => {
            const {p, customer} = await shopper(1000, 1)
            await changeVariant(ctx.app, p.variants[0], {stock: 0})

            expectError(await placeOrder(customer), 409, 'CART_CHECKOUT_BLOCKED')
            expect(await ordersOf(customer)).toEqual([])
        })

        it('rejects a customer whose profile has no name', async () => {
            const p = await product()
            const customer = await createCustomer(ctx, {withProfile: false})
            await fillCart(customer.api, [{variantId: p.variantIds[0]}])

            expectError(await placeOrder(customer), 400, 'ORDER_RECIPIENT_INCOMPLETE')
            expect(await ordersOf(customer)).toEqual([])
        })

        it('rejects an unknown address and an address of another user', async () => {
            const {customer} = await shopper()
            const stranger = await createCustomer(ctx)

            expect((await placeOrder(customer, {addressId: randomId()})).statusCode).toBe(400)
            expect((await placeOrder(customer, {addressId: stranger.addressId})).statusCode).toBe(400)
            expect(await ordersOf(customer)).toEqual([])
        })

        it.each([
            ['a missing addressId', {addressId: undefined}],
            ['a malformed addressId', {addressId: 'nope'}],
            ['a negative expectedTotal', {expectedTotal: -1}],
            ['a fractional expectedTotal', {expectedTotal: 10.5}],
            ['a non-numeric expectedTotal', {expectedTotal: 'abc'}],
        ])('rejects %s', async (_label, body) => {
            const {customer} = await shopper()

            expectValidationError(await placeOrder(customer, body))
        })

        it('keeps the cart intact when placing fails', async () => {
            const customer = await createCustomer(ctx)
            const p = await product()
            await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 2}])

            await placeOrder(customer, {expectedTotal: 1})

            expect((await getCart(customer.api)).items[0].quantity).toBe(2)
        })
    })
})
