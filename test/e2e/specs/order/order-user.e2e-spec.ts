import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    qs,
    randomId,
    sleep,
    walkPages,
} from '../../../util/test.util'
import {createPublishedProduct, imageKeyOf} from '../product/product-test.util'
import {createCoupon} from '../discount/discount-test.util'
import {
    Customer,
    PAYMENT_WINDOW_MS,
    adminStatus,
    createCustomer,
    fillCart,
    getOrder,
    orderSystemUseCases,
    placeOk,
    shippingFeeFor,
    statusesOf,
    withNowPlus,
} from './order-test.util'
import {getCart} from "../cart/cart-test.util";

describe('Orders: my orders (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let uc: ReturnType<typeof orderSystemUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        uc = orderSystemUseCases(ctx.app)
    })

    const product = (price = 1000) => createPublishedProduct(ctx.app, admin, {variants: [{price, stock: 50}]})

    const shopper = async (price = 1000) => {
        const p = await product(price)
        const customer = await createCustomer(ctx)
        await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 1}])
        return {p, customer}
    }

    const couponUsage = async (couponId: string) =>
        (await admin.get(`/admin/coupons/${couponId}/usage`)).json().data

    describe('GET /orders', () => {
        it('is empty for a customer without orders', async () => {
            const customer = await createCustomer(ctx)

            const res = await customer.api.get('/orders')

            expectOk(res, 200, 'ORDER_LIST_SUCCESS')
            expect(res.json().data).toEqual({items: [], nextCursor: null})
        })

        it('lists own orders newest first with the summary shape', async () => {
            const {p, customer} = await shopper(1000)
            const first = await placeOk(customer)
            await sleep(15)
            const second = await placeOk(customer)

            const {items} = (await customer.api.get('/orders')).json().data

            expect(items.map((o: any) => o.id)).toEqual([second.id, first.id])
            expect(items[0]).toEqual({
                id: second.id,
                orderNumber: second.orderNumber,
                status: 'pending_payment',
                itemCount: 1,
                total: 1000 + shippingFeeFor(1000),
                currency: second.currency,
                previewImageKey: imageKeyOf(p.id),
                createdAt: second.createdAt,
                paidAt: null,
            })
        })

        it('shows only the customer\'s own orders', async () => {
            const [a, b] = [await shopper(), await shopper()]
            const own = await placeOk(a.customer)
            await placeOk(b.customer)

            const {items} = (await a.customer.api.get('/orders')).json().data

            expect(items.map((o: any) => o.id)).toEqual([own.id])
        })

        it('reflects status changes', async () => {
            const {customer} = await shopper()
            const order = await placeOk(customer)
            await uc.markPaid.execute(order.id)

            const [summary] = (await customer.api.get('/orders')).json().data.items

            expect(summary).toMatchObject({status: 'paid', paidAt: expect.any(String)})
        })

        it('paginates with a cursor (default page size 10)', async () => {
            const {customer} = await shopper()
            for (let i = 0; i < 11; i++) await placeOk(customer)

            const first = (await customer.api.get('/orders')).json().data
            expect(first.items).toHaveLength(10)
            expect(typeof first.nextCursor).toBe('string')

            const second = (await customer.api.get(`/orders${qs({nextCursor: first.nextCursor})}`)).json().data
            expect(second.items).toHaveLength(1)
            expect(second.nextCursor).toBeNull()
        })

        it('walks without gaps or duplicates and ignores a malformed cursor', async () => {
            const {customer} = await shopper()
            const placed: any[] = []
            for (let i = 0; i < 5; i++) {
                placed.push((await placeOk(customer)).id)
                await sleep(5)
            }

            const pages = await walkPages(customer.api, '/orders', {pageSize: 2})

            expect(pages.flatMap((p) => p.items.map((o: any) => o.id))).toEqual([...placed].reverse())
            expect((await customer.api.get(`/orders${qs({nextCursor: 'garbage'})}`)).statusCode).toBe(200)
        })

        it.each([
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=101', {pageSize: 101}],
            ['pageSize=abc', {pageSize: 'abc'}],
            ['a cursor over 512 characters', {nextCursor: 'x'.repeat(513)}],
        ])('rejects %s', async (_label, params) => {
            const customer = await createCustomer(ctx)

            expectValidationError(await customer.api.get(`/orders${qs(params as any)}`))
        })
    })

    describe('GET /orders/:id', () => {
        it('returns the order detail', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)

            const res = await customer.api.get(`/orders/${placed.id}`)

            expectOk(res, 200, 'ORDER_GET_SUCCESS')
            expect(res.json().data).toEqual(placed)
        })

        it('shows the status timeline of a progressed order', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)
            await uc.markPaid.execute(placed.id)
            await adminStatus(admin, placed.id, {action: 'startProcessing', note: 'Packing'})
            await adminStatus(admin, placed.id, {action: 'ship', carrier: 'Post', trackingCode: 'TRK123'})

            const order = await getOrder(customer.api, placed.id)

            expect(order.status).toBe('shipped')
            expect(order.shipment).toEqual({carrier: 'Post', trackingCode: 'TRK123'})
            expect(statusesOf(order.timeline)).toEqual(['pending_payment', 'paid', 'processing', 'shipped'])
            expect(order.timeline.find((e: any) => e.status === 'processing')).toMatchObject({note: 'Packing'})
            order.timeline.forEach((e: any) => expect(e).not.toHaveProperty('actorId')) // admin-only field
            expect(order.canPay).toBe(false)
            expect(order.paidAt).toEqual(expect.any(String))
        })

        it('answers 404 for someone else\'s order, an unknown order and 400 for a malformed id', async () => {
            const [owner, stranger] = [await shopper(), await createCustomer(ctx)]
            const order = await placeOk(owner.customer)

            expectError(await stranger.api.get(`/orders/${order.id}`), 404, 'ORDER_NOT_FOUND')
            expectError(await owner.customer.api.get(`/orders/${randomId()}`), 404, 'ORDER_NOT_FOUND')
            expectValidationError(await owner.customer.api.get('/orders/not-a-uuid'))
        })

        it('reports canPay=false once the payment window has passed', async () => {
            const {customer} = await shopper()
            const order = await placeOk(customer)

            const info = await withNowPlus(PAYMENT_WINDOW_MS + 60_000, () => uc.getPaymentInfo.execute(order.id))

            expect(info).toMatchObject({status: 'pending_payment', canPay: false})
        })
    })

    describe('POST /orders/:id/cancel', () => {
        it('cancels an unpaid order', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)

            const res = await customer.api.post(`/orders/${placed.id}/cancel`)

            expectOk(res, 200, 'ORDER_CANCEL_SUCCESS')
            expect(res.json().data).toMatchObject({id: placed.id, status: 'cancelled', canPay: false})
            expect(statusesOf(res.json().data.timeline)).toEqual(['pending_payment', 'cancelled'])
            expect((await getOrder(customer.api, placed.id)).status).toBe('cancelled')
        })

        it('releases the coupon reservation so the slot can be used again', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1})
            const {customer} = await shopper()
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const placed = await placeOk(customer)
            expect(await couponUsage(coupon.id)).toMatchObject({reserved: 1, released: 0})

            await customer.api.post(`/orders/${placed.id}/cancel`)

            expect(await couponUsage(coupon.id)).toEqual({reserved: 0, committed: 0, released: 1, totalDiscount: 0})
            const other = await shopper()
            expect((await other.customer.api.put('/cart/coupon', {code: coupon.code})).statusCode).toBe(200)
        })

        it('cannot be done twice', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)
            await customer.api.post(`/orders/${placed.id}/cancel`)

            expectError(await customer.api.post(`/orders/${placed.id}/cancel`), 409, 'ORDER_INVALID_STATUS_TRANSITION')
        })

        it('is only possible while the order is pending payment', async () => {
            const {customer} = await shopper()
            const paid = await placeOk(customer)
            await uc.markPaid.execute(paid.id)
            const p = await product(20000)
            await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 1}])

            const processing = await placeOk(customer)
            await uc.markPaid.execute(processing.id)
            await adminStatus(admin, processing.id, {action: 'startProcessing'})

            expectError(await customer.api.post(`/orders/${paid.id}/cancel`), 409, 'ORDER_INVALID_STATUS_TRANSITION')
            expectError(await customer.api.post(`/orders/${processing.id}/cancel`), 409, 'ORDER_INVALID_STATUS_TRANSITION')
            expect((await getOrder(customer.api, paid.id)).status).toBe('paid')
        })

        it('answers 404 for someone else\'s order and leaves it untouched', async () => {
            const [owner, stranger] = [await shopper(), await createCustomer(ctx)]
            const order = await placeOk(owner.customer)

            expectError(await stranger.api.post(`/orders/${order.id}/cancel`), 404, 'ORDER_NOT_FOUND')
            expect((await getOrder(owner.customer.api, order.id)).status).toBe('pending_payment')
        })

        it('answers 404 for an unknown order and 400 for a malformed id', async () => {
            const customer: Customer = await createCustomer(ctx)

            expectError(await customer.api.post(`/orders/${randomId()}/cancel`), 404, 'ORDER_NOT_FOUND')
            expectValidationError(await customer.api.post('/orders/not-a-uuid/cancel'))
        })
    })
})
