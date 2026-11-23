import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    anonymousApi,
    createUserSession,
    expectValidationError,
    randomId,
    withNowPlus,
    sleep
} from '../../util/test.util'
import {fakePaymentGateway as gateway, RESULT_URL} from '../../util/fake-payment-gateway'
import {createPublishedProduct} from '../product/product-test.util'
import {getCart} from '../cart/cart-test.util'
import {createCoupon} from '../discount/discount-test.util'
import {Customer, createCustomer, getOrder, orderSystemUseCases, statusesOf} from '../order/order-test.util'
import {callbackGet, callbackPost, getPayment, orderFor, orderPayments, redirectOf, startOk} from './payment-test.util'

describe('Payments: gateway callback and confirmation (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let customer: Customer
    let variantId: string
    let orders: ReturnType<typeof orderSystemUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        customer = await createCustomer(ctx)
        orders = orderSystemUseCases(ctx.app)
        variantId = (await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 100000}]})).variantIds[0]
    })

    afterEach(() => gateway.reset())

    /** An order with a started payment. */
    const started = async (quantity = 1) => {
        const order = await orderFor(customer, variantId, quantity)
        return {order, ...(await startOk(customer, order.id))}
    }
    const orderStatus = async (id: string) => (await getOrder(customer.api, id)).status as string

    describe('a successful payment', () => {
        it('redirects the shopper to the result page with status=paid', async () => {
            const {order, paymentId, reference} = await started()
            gateway.approve(reference, order.total)

            const res = await callbackGet(ctx.app, {trackId: reference})

            const {base, params} = redirectOf(res)
            expect(base).toBe(RESULT_URL)
            expect(params).toEqual({status: 'paid', orderId: order.id, paymentId})
        })

        it('marks the payment as paid with the gateway details and confirms the order', async () => {
            const {order, paymentId, reference} = await started(2)
            gateway.approve(reference, order.total, {trackingCode: 'TRK-123', cardMask: '603799******9999'})

            await callbackGet(ctx.app, {trackId: reference})

            expect(await getPayment(customer.api, paymentId)).toMatchObject({status: 'paid', paidAt: expect.any(String)})
            expect((await orderPayments(admin, order.id))[0]).toMatchObject({
                status: 'paid',
                trackingCode: 'TRK-123',
                cardMask: '603799******9999',
                failureReason: null,
                orderConfirmedAt: expect.any(String),
            })
            const detail = await getOrder(customer.api, order.id)
            expect(detail).toMatchObject({status: 'paid', canPay: false, paidAt: expect.any(String)})
            expect(statusesOf(detail.timeline)).toEqual(['pending_payment', 'paid'])
        })

        it('uses the gateway\'s paid time when it provides one', async () => {
            const {order, paymentId, reference} = await started()
            const paidAt = new Date(Date.now() - 60_000)
            gateway.approve(reference, order.total, {paidAt})

            await callbackGet(ctx.app, {trackId: reference})

            expect((await getPayment(customer.api, paymentId)).paidAt).toBe(paidAt.toISOString())
        })

        it('accepts a verification that does not report an amount', async () => {
            const {order, paymentId, reference} = await started()
            gateway.approve(reference, null)

            await callbackGet(ctx.app, {trackId: reference})

            expect((await getPayment(customer.api, paymentId)).status).toBe('paid')
            expect(await orderStatus(order.id)).toBe('paid')
        })

        it('clears the shopper\'s cart and commits the coupon of the order', async () => {
            const coupon = await createCoupon(admin, {value: 10})
            const order = await (async () => {
                await customer.api.delete('/cart')
                await customer.api.post('/cart/items', {variantId, quantity: 2})
                await customer.api.put('/cart/coupon', {code: coupon.code})
                const res = await customer.api.post('/orders', {addressId: customer.addressId}, {'idempotency-key': `key-${randomId()}`})
                return res.json().data
            })()
            const {reference} = await startOk(customer, order.id)
            gateway.approve(reference, order.total)

            await callbackGet(ctx.app, {trackId: reference})

            expect((await getCart(customer.api)).items).toEqual([])
            const usage = (await admin.get(`/admin/coupons/${coupon.id}/usage`)).json().data
            expect(usage).toMatchObject({reserved: 0, committed: 1})
        })

        it('is idempotent: repeating the callback does not verify or pay again', async () => {
            const {order, paymentId, reference} = await started()
            gateway.approve(reference, order.total)
            await callbackGet(ctx.app, {trackId: reference})

            const again = await callbackGet(ctx.app, {trackId: reference})

            expect(redirectOf(again).params).toEqual({status: 'paid', orderId: order.id, paymentId})
            expect(gateway.verifyCount(reference)).toBe(1)
            const detail = await getOrder(customer.api, order.id)
            expect(detail.timeline.filter((e: any) => e.status === 'paid')).toHaveLength(1)
        })

        it('handles parallel callbacks for the same payment', async () => {
            const {order, paymentId, reference} = await started()
            gateway.approve(reference, order.total)

            const results = await Promise.all([callbackGet(ctx.app, {trackId: reference}), callbackGet(ctx.app, {trackId: reference})])

            for (const res of results) expect(redirectOf(res).params).toMatchObject({status: 'paid', paymentId})
            const detail = await getOrder(customer.api, order.id)
            expect(detail.status).toBe('paid')
            expect(detail.timeline.filter((e: any) => e.status === 'paid')).toHaveLength(1)
            expect((await orderPayments(admin, order.id))[0].orderConfirmedAt).not.toBeNull()
        })

        it('takes the first value when the gateway repeats the trackId parameter', async () => {
            const {order, reference} = await started()
            gateway.approve(reference, order.total)

            const res = await callbackGet(ctx.app, {trackId: [reference, 'other']})

            expect(redirectOf(res).params.status).toBe('paid')
        })

        it('also works with POST callbacks and needs no session or CSRF token', async () => {
            const {order, reference} = await started()
            gateway.approve(reference, order.total)

            const res = await callbackPost(ctx.app, {trackId: reference})

            expect(redirectOf(res).params.status).toBe('paid')
            expect(await orderStatus(order.id)).toBe('paid')
        })

        it('pays an order twice only once when two payments of the same order both succeed', async () => {
            const order = await orderFor(customer, variantId)
            const [first, second] = [await startOk(customer, order.id), await startOk(customer, order.id)]
            gateway.approve(first.reference, order.total)
            gateway.approve(second.reference, order.total)

            await callbackGet(ctx.app, {trackId: first.reference})
            await callbackGet(ctx.app, {trackId: second.reference})

            const detail = await getOrder(customer.api, order.id)
            expect(detail.timeline.filter((e: any) => e.status === 'paid')).toHaveLength(1)
            expect((await orderPayments(admin, order.id)).map((p) => p.status)).toEqual(['paid', 'paid'])
        })
    })

    describe('payments that are not completed', () => {
        it('redirects with status=pending while the gateway has no result, and succeeds later', async () => {
            const {order, paymentId, reference} = await started()

            const first = await callbackGet(ctx.app, {trackId: reference})
            expect(redirectOf(first).params).toEqual({status: 'pending', orderId: order.id, paymentId})
            expect((await getPayment(customer.api, paymentId)).status).toBe('redirected')
            expect(await orderStatus(order.id)).toBe('pending_payment')

            gateway.approve(reference, order.total)
            const second = await callbackGet(ctx.app, {trackId: reference})
            expect(redirectOf(second).params.status).toBe('paid')
            expect(gateway.verifyCount(reference)).toBe(2)
        })

        it('redirects with status=failed for a declined payment, stores the reason and leaves the order payable', async () => {
            const {order, paymentId, reference} = await started()
            gateway.decline(reference, 'insufficient_funds')

            const res = await callbackGet(ctx.app, {trackId: reference})

            expect(redirectOf(res).params).toEqual({status: 'failed', orderId: order.id, paymentId})
            expect((await orderPayments(admin, order.id))[0]).toMatchObject({status: 'failed', failureReason: 'insufficient_funds', paidAt: null})
            expect(await orderStatus(order.id)).toBe('pending_payment')
        })

        it('uses the reason "declined" when the gateway gives none', async () => {
            const {order, reference} = await started()
            gateway.decline(reference)

            await callbackGet(ctx.app, {trackId: reference})

            expect((await orderPayments(admin, order.id))[0].failureReason).toBe('declined')
        })

        it('does not ask the gateway again for a payment that already failed', async () => {
            const {order, reference} = await started()
            gateway.decline(reference)
            await callbackGet(ctx.app, {trackId: reference})
            gateway.approve(reference, order.total) // too late: the failure is final

            const again = await callbackGet(ctx.app, {trackId: reference})

            expect(redirectOf(again).params.status).toBe('failed')
            expect(gateway.verifyCount(reference)).toBe(1)
            expect(await orderStatus(order.id)).toBe('pending_payment')
        })

        it('fails a payment whose verified amount differs and does not pay the order', async () => {
            const {order, paymentId, reference} = await started()
            gateway.approve(reference, order.total - 1)

            const res = await callbackGet(ctx.app, {trackId: reference})

            expect(redirectOf(res).params).toEqual({status: 'failed', orderId: order.id, paymentId})
            expect((await orderPayments(admin, order.id))[0]).toMatchObject({status: 'failed', failureReason: 'amount_mismatch'})
            expect(await orderStatus(order.id)).toBe('pending_payment')
        })

        it('lets the customer pay after a failed attempt', async () => {
            const {order, reference} = await started()
            gateway.decline(reference)
            await callbackGet(ctx.app, {trackId: reference})

            const retry = await startOk(customer, order.id)
            gateway.approve(retry.reference, order.total)
            await callbackGet(ctx.app, {trackId: retry.reference})

            expect(await orderStatus(order.id)).toBe('paid')
            expect((await orderPayments(admin, order.id)).map((p) => p.status).sort()).toEqual(['failed', 'paid'])
        })

        it('treats a gateway error during verification as "pending" and keeps the payment open', async () => {
            const {order, paymentId, reference} = await started()
            gateway.failVerify(reference)

            const res = await callbackGet(ctx.app, {trackId: reference})

            expect(redirectOf(res).params).toEqual({status: 'pending', orderId: order.id, paymentId})
            expect((await getPayment(customer.api, paymentId)).status).toBe('redirected')
        })
    })

    describe('invalid callbacks', () => {
        it.each([
            ['an unknown trackId', {trackId: 'does-not-exist'}],
            ['a blank trackId', {trackId: '   '}],
            ['no parameters at all', {}],
        ])('redirects with status=invalid for %s and verifies nothing', async (_label, query) => {
            const res = await callbackGet(ctx.app, query)

            const {base, params} = redirectOf(res)
            expect(base).toBe(RESULT_URL)
            expect(params).toEqual({status: 'invalid'})
            expect(gateway.verifyCalls).toEqual([])
        })

        it('redirects with status=invalid for a well-formed but unsupported gateway', async () => {
            const {reference} = await started()

            const res = await callbackGet(ctx.app, {trackId: reference}, 'other')

            expect(redirectOf(res).params).toEqual({status: 'invalid'})
        })

        it('answers 400 for a malformed gateway name', async () => {
            expectValidationError(await anonymousApi(ctx.app).get('/payments/callback/BAD%20NAME'))
        })

        it('does not leak anything about other payments', async () => {
            const {reference} = await started()

            const res = await callbackGet(ctx.app, {trackId: `${reference}-x`})

            expect(redirectOf(res).params).toEqual({status: 'invalid'})
        })
    })

    describe('late payment (runs last: expires every pending order)', () => {
        it('still pays an order that expired while the shopper was at the gateway', async () => {
            const {order, paymentId, reference} = await started()
            await withNowPlus(31 * 60_000, () => orders.expireUnpaid.execute())
            expect(await orderStatus(order.id)).toBe('expired')
            gateway.approve(reference, order.total)

            const res = await callbackGet(ctx.app, {trackId: reference})

            expect(redirectOf(res).params).toEqual({status: 'paid', orderId: order.id, paymentId})
            const detail = await getOrder(customer.api, order.id)
            expect(detail.status).toBe('paid')
            expect(statusesOf(detail.timeline)).toEqual(['pending_payment', 'paid','expired'])
        })
    })
})
