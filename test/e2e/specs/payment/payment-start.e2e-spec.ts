import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {IStartPayment} from '@api/payment/application'
import {UserRole} from '@api/users/domain'
import {START_PAYMENT} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    withNowPlus,
} from '../../util/test.util'
import {fakePaymentGateway as gateway, CALLBACK_BASE} from '../../util/fake-payment-gateway'
import {createPublishedProduct} from '../product/product-test.util'
import {CURRENCY, Customer, createCustomer, orderSystemUseCases} from '../order/order-test.util'
import {getPayment, orderFor, orderPayments, startOk, startPayment} from './payment-test.util'

describe('Payments: starting a payment (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let customer: Customer
    let variantId: string

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        customer = await createCustomer(ctx)
        variantId = (await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 100000}]})).variantIds[0]
    })

    afterEach(() => gateway.reset())

    const order = (quantity = 1) => orderFor(customer, variantId, quantity)

    describe('POST /payments', () => {
        it('creates a payment, asks the gateway and returns the redirect URL', async () => {
            const placed = await order(2)

            const res = await startPayment(customer, placed.id)

            expectOk(res, 201, 'PAYMENT_START_SUCCESS')
            expect(res.json().data).toEqual({paymentId: expect.any(String), redirectUrl: expect.stringMatching(/^https:\/\/gateway\.test\/start\/trk-/)})
        })

        it('sends the order total, the callback URL and a description to the gateway', async () => {
            const placed = await order(3)

            const {paymentId} = await startOk(customer, placed.id)

            expect(gateway.requests).toHaveLength(1)
            expect(gateway.requests[0]).toEqual({
                paymentId,
                amount: placed.total, // Toman, shipping included
                callbackUrl: `${CALLBACK_BASE}/payments/callback/zibal`,
                description: expect.any(String),
            })
        })

        it('stores the payment as redirected with the order amount and currency', async () => {
            const placed = await order()

            const {paymentId} = await startOk(customer, placed.id)

            expect(await getPayment(customer.api, paymentId)).toEqual({
                paymentId,
                orderId: placed.id,
                status: 'redirected',
                amount: placed.total,
                currency: CURRENCY,
                paidAt: null,
            })
        })

        it('remembers the gateway reference for the admin', async () => {
            const placed = await order()

            const started = await startOk(customer, placed.id)

            const [payment] = await orderPayments(admin, placed.id)
            expect(payment).toMatchObject({paymentId: started.paymentId, gateway: 'zibal', reference: started.reference, status: 'redirected'})
        })

        it('accepts the gateway name explicitly', async () => {
            const placed = await order()

            expect((await startPayment(customer, placed.id, {gateway: 'zibal'})).statusCode).toBe(201)
        })

        it('allows several payment attempts for the same order', async () => {
            const placed = await order()

            const [first, second] = [await startOk(customer, placed.id), await startOk(customer, placed.id)]

            expect(first.paymentId).not.toBe(second.paymentId)
            expect(first.reference).not.toBe(second.reference)
            expect(await orderPayments(admin, placed.id)).toHaveLength(2)
        })

        it('does not change the order (it stays pending until the payment is confirmed)', async () => {
            const placed = await order()

            await startOk(customer, placed.id)

            const detail = (await customer.api.get(`/orders/${placed.id}`)).json().data
            expect(detail).toMatchObject({status: 'pending_payment', canPay: true})
        })
    })

    describe('rejected requests', () => {
        it.each(['other', 'stripe'])('rejects the unknown gateway %p and stores nothing', async (name) => {
            const placed = await order()

            expectError(await startPayment(customer, placed.id, {gateway: name}), 400, 'PAYMENT_GATEWAY_NOT_SUPPORTED')

            expect(await orderPayments(admin, placed.id)).toEqual([])
            expect(gateway.requests).toEqual([])
        })

        it('rejects a gateway that does not support the order currency', async () => {
            const placed = await order()
            gateway.currencies = ['USD']

            expectError(await startPayment(customer, placed.id), 400, 'PAYMENT_GATEWAY_NOT_SUPPORTED')

            expect(await orderPayments(admin, placed.id)).toEqual([])
        })

        it('answers ORDER_NOT_FOUND for an unknown order and for someone else\'s order', async () => {
            const placed = await order()
            const stranger = await createCustomer(ctx)

            expectError(await startPayment(customer, randomId()), 404, 'ORDER_NOT_FOUND')
            expectError(await startPayment(stranger, placed.id), 404, 'ORDER_NOT_FOUND')
            expect(await orderPayments(admin, placed.id)).toEqual([])
        })

        it.each(['cancelled', 'paid'])('answers ORDER_NOT_PAYABLE for a %s order', async (status) => {
            const placed = await order()
            if (status === 'cancelled') await customer.api.post(`/orders/${placed.id}/cancel`)
            else await orderSystemUseCases(ctx.app).markPaid.execute(placed.id)

            expectError(await startPayment(customer, placed.id), 409, 'ORDER_NOT_PAYABLE')
            expect(await orderPayments(admin, placed.id)).toEqual([])
        })

        it('answers ORDER_NOT_PAYABLE once the 30 minute payment window has passed', async () => {
            const placed = await order()
            const start = ctx.app.get<IStartPayment>(START_PAYMENT, {strict: false})

            await expect(
                withNowPlus(31 * 60_000, () => start.execute({orderId: placed.id}, customer.userId)),
            ).rejects.toMatchObject({code: 'ORDER_NOT_PAYABLE', status: 409})
        })

        it.each([
            ['a missing orderId', {}],
            ['a malformed orderId', {orderId: 'nope'}],
            ['an upper-case gateway', {orderId: randomId(), gateway: 'Zibal'}],
            ['a gateway with a space', {orderId: randomId(), gateway: 'my gateway'}],
            ['a gateway over 30 characters', {orderId: randomId(), gateway: 'g'.repeat(31)}],
            ['an empty gateway', {orderId: randomId(), gateway: ''}],
        ])('rejects %s', async (_label, body) => {
            expectValidationError(await customer.api.post('/payments', body))
        })
    })

    describe('when the gateway fails', () => {
        it('answers 502, records the payment as failed and lets the customer try again', async () => {
            const placed = await order()
            gateway.failNextRequest()

            expectError(await startPayment(customer, placed.id), 502, 'PAYMENT_GATEWAY_FAILED')

            const [failed] = await orderPayments(admin, placed.id)
            expect(failed).toMatchObject({status: 'failed', failureReason: 'gateway_request_failed', reference: null})
            const retry = await startOk(customer, placed.id)
            expect(retry.paymentId).not.toBe(failed.paymentId)
            expect((await getPayment(customer.api, retry.paymentId)).status).toBe('redirected')
        })
    })

    describe('access control', () => {
        it('needs a session and the CSRF header', async () => {
            const placed = await order()
            const body = {orderId: placed.id}

            expect([401, 403]).toContain((await anonymousApi(ctx.app).post('/payments', body)).statusCode)
            expect([401, 403]).toContain((await apiWithoutCsrf(ctx.app, customer.session).post('/payments', body)).statusCode)
            expect(await orderPayments(admin, placed.id)).toEqual([])
        })
    })
})
