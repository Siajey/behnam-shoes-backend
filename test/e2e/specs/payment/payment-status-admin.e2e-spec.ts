import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    UserSession,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
} from '../../util/test.util'
import {fakePaymentGateway as gateway} from '../../util/fake-payment-gateway'
import {createPublishedProduct} from '../product/product-test.util'
import {CURRENCY, Customer, createCustomer} from '../order/order-test.util'
import {callbackGet, orderFor, orderPayments, startOk} from './payment-test.util'
import {ensureShippingMethods} from "../shipping/shipping-test.util";

describe('Payments: status and admin list (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let customer: Customer
    let variantId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        await ensureShippingMethods(admin)
        customer = await createCustomer(ctx)
        variantId = (await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 100000}]})).variantIds[0]
    })

    describe('GET /payments/:id', () => {
        it('returns the status of the customer\'s payment (no gateway internals)', async () => {
            const order = await orderFor(customer, variantId)
            const {paymentId} = await startOk(customer, order.id)

            const res = await customer.api.get(`/payments/${paymentId}`)

            expectOk(res, 200, 'PAYMENT_GET_SUCCESS')
            expect(res.json().data).toEqual({paymentId, orderId: order.id, status: 'redirected', amount: order.total, currency: CURRENCY, paidAt: null})
        })

        it('follows the payment to paid and shows the paid time', async () => {
            const order = await orderFor(customer, variantId)
            const {paymentId, reference} = await startOk(customer, order.id)
            gateway.approve(reference, order.total)
            await callbackGet(ctx.app, {trackId: reference})

            const data = (await customer.api.get(`/payments/${paymentId}`)).json().data

            expect(data).toMatchObject({status: 'paid', paidAt: expect.any(String)})
        })

        it('answers 404 for someone else\'s payment and for an unknown one', async () => {
            const order = await orderFor(customer, variantId)
            const {paymentId} = await startOk(customer, order.id)
            const stranger = await createCustomer(ctx)

            expectError(await stranger.api.get(`/payments/${paymentId}`), 404, 'PAYMENT_NOT_FOUND')
            expectError(await customer.api.get(`/payments/${randomId()}`), 404, 'PAYMENT_NOT_FOUND')
        })

        it('answers 400 for a malformed id and needs a session (but no CSRF header)', async () => {
            const order = await orderFor(customer, variantId)
            const {paymentId} = await startOk(customer, order.id)

            expectValidationError(await customer.api.get('/payments/not-a-uuid'))
            expect([401, 403]).toContain((await anonymousApi(ctx.app).get(`/payments/${paymentId}`)).statusCode)
            expect((await apiWithoutCsrf(ctx.app, customer.session).get(`/payments/${paymentId}`)).statusCode).toBe(200)
        })
    })

    describe('GET /admin/orders/:id/payments', () => {
        it('lists every attempt of an order with the admin details', async () => {
            const order = await orderFor(customer, variantId)
            const [failed, paid] = [await startOk(customer, order.id), await startOk(customer, order.id)]
            gateway.decline(failed.reference, 'declined_by_bank')
            gateway.approve(paid.reference, order.total, {trackingCode: 'TRK-ADMIN', cardMask: '603799******0001'})
            await callbackGet(ctx.app, {trackId: failed.reference})
            await callbackGet(ctx.app, {trackId: paid.reference})

            const res = await admin.get(`/admin/orders/${order.id}/payments`)

            expectOk(res, 200, 'PAYMENT_LIST_SUCCESS')
            const items = res.json().data.items as any[]
            expect(items).toHaveLength(2)
            const byId = Object.fromEntries(items.map((p) => [p.paymentId, p]))
            expect(byId[paid.paymentId]).toEqual({
                paymentId: paid.paymentId,
                orderId: order.id,
                status: 'paid',
                amount: order.total,
                currency: CURRENCY,
                paidAt: expect.any(String),
                gateway: 'zibal',
                reference: paid.reference,
                trackingCode: 'TRK-ADMIN',
                cardMask: '603799******0001',
                failureReason: null,
                orderConfirmedAt: expect.any(String),
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            })
            expect(byId[failed.paymentId]).toMatchObject({status: 'failed', failureReason: 'declined_by_bank', trackingCode: null, cardMask: null, paidAt: null, orderConfirmedAt: null})
        })

        it('returns an empty list for an order without payments and does not mix orders', async () => {
            const [withPayment, without] = [await orderFor(customer, variantId), await orderFor(customer, variantId)]
            await startOk(customer, withPayment.id)

            expect(await orderPayments(admin, without.id)).toEqual([])
            expect(await orderPayments(admin, withPayment.id)).toHaveLength(1)
            expect(await orderPayments(admin, randomId())).toEqual([])
        })

        it('answers 400 for a malformed order id', async () => {
            expectValidationError(await admin.get('/admin/orders/not-a-uuid/payments'))
        })

        it('is admin only', async () => {
            const order = await orderFor(customer, variantId)
            await startOk(customer, order.id)
            const url = `/admin/orders/${order.id}/payments`

            expect([401, 403]).toContain((await anonymousApi(ctx.app).get(url)).statusCode)
            expect((await customer.api.get(url)).statusCode).toBe(403)
        })
    })
})
