import {beforeAll, describe, expect, it, jest} from '@jest/globals'

import {IReconcilePayments} from '@api/payment/application'
import {ReconcilePaymentsJob} from '@api/payment/infrastructure'
import {UserRole} from '@api/users/domain'
import {PAYMENT_ORDERS, RECONCILE_PAYMENTS} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, withNowPlus} from '../../util/test.util'
import {fakePaymentGateway as gateway} from '../../util/fake-payment-gateway'
import {createPublishedProduct} from '../product/product-test.util'
import {Customer, createCustomer, getOrder} from '../order/order-test.util'
import {callbackGet, getPayment, orderFor, orderPayments, startOk} from './payment-test.util'

const MIN = 60_000
const EXPIRY = Number(process.env.PAYMENT_EXPIRY_MINUTES ?? 60)
const ZERO = {checked: 0, paid: 0, failed: 0, expired: 0, ordersSynced: 0}

describe('Payments: reconciliation job (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let customer: Customer
    let variantId: string
    let reconcile: IReconcilePayments

    // payments of the scenario
    let paidAtGateway: Awaited<ReturnType<typeof open>>
    let declined: typeof paidAtGateway
    let stillPending: typeof paidAtGateway
    let pendingToo: typeof paidAtGateway
    let gatewayDown: typeof paidAtGateway
    let unsynced: typeof paidAtGateway

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        customer = await createCustomer(ctx)
        variantId = (await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 100000}]})).variantIds[0]
        reconcile = ctx.app.get<IReconcilePayments>(RECONCILE_PAYMENTS, {strict: false})
    })

    async function open() {
        const order = await orderFor(customer, variantId)
        return {order, ...(await startOk(customer, order.id))}
    }
    const status = async (p: {paymentId: string}) => (await getPayment(customer.api, p.paymentId)).status as string
    const orderStatus = async (p: {order: {id: string}}) => (await getOrder(customer.api, p.order.id)).status as string

    it('does nothing at first: open payments are too young and there is nothing unconfirmed', async () => {
        ;[paidAtGateway, declined, stillPending, pendingToo, gatewayDown] = [
            await open(), await open(), await open(), await open(), await open(),
        ]

        expect(await reconcile.execute()).toEqual(ZERO)
        expect(await status(paidAtGateway)).toBe('redirected')
    })

    it('syncs a paid payment whose order could not be confirmed (callback while the order module failed)', async () => {
        unsynced = await open()
        gateway.approve(unsynced.reference, unsynced.order.total)
        const orders = ctx.app.get<{markPaid: (id: string) => Promise<void>}>(PAYMENT_ORDERS, {strict: false})
        jest.spyOn(orders, 'markPaid').mockRejectedValueOnce(new Error('order module down'))

        const res = await callbackGet(ctx.app, {trackId: unsynced.reference})

        // the money was taken: the shopper sees "paid" even though the order is not confirmed yet
        expect(new URL(res.headers.location as string).searchParams.get('status')).toBe('paid')
        expect(await status(unsynced)).toBe('paid')
        expect(await orderStatus(unsynced)).toBe('pending_payment')
        expect((await orderPayments(admin, unsynced.order.id))[0].orderConfirmedAt).toBeNull()
    })

    it('verifies old open payments, records the results and confirms unconfirmed orders', async () => {
        gateway.approve(paidAtGateway.reference, paidAtGateway.order.total)
        gateway.decline(declined.reference, 'declined')
        gateway.pending(stillPending.reference)
        gateway.pending(pendingToo.reference)
        gateway.failVerify(gatewayDown.reference)

        const result = await withNowPlus(6 * MIN, () => reconcile.execute())

        // 5 open payments + 1 paid-but-unconfirmed
        expect(result).toEqual({checked: 6, paid: 1, failed: 1, expired: 0, ordersSynced: 1})
        expect(await status(paidAtGateway)).toBe('paid')
        expect(await orderStatus(paidAtGateway)).toBe('paid')
        expect(await status(declined)).toBe('failed')
        expect(await orderStatus(declined)).toBe('pending_payment')
        expect(await status(stillPending)).toBe('redirected')
        expect(await status(gatewayDown)).toBe('redirected')
        expect(await orderStatus(unsynced)).toBe('paid')
        expect((await orderPayments(admin, unsynced.order.id))[0].orderConfirmedAt).not.toBeNull()
    })

    it('does not touch finished payments on later runs', async () => {
        const before = gateway.verifyCount(paidAtGateway.reference) + gateway.verifyCount(declined.reference)

        await withNowPlus(7 * MIN, () => reconcile.execute())

        expect(gateway.verifyCount(paidAtGateway.reference) + gateway.verifyCount(declined.reference)).toBe(before)
    })

    it('expires payments that stayed open past the expiry time, but skips ones the gateway could not answer for', async () => {
        const result = await withNowPlus((EXPIRY + 1) * MIN, () => reconcile.execute())

        expect(result).toEqual({checked: 3, paid: 0, failed: 0, expired: 2, ordersSynced: 0})
        expect(await status(stillPending)).toBe('expired')
        expect(await status(pendingToo)).toBe('expired')
        expect(await status(gatewayDown)).toBe('redirected') // verification errors are skipped, never expired blindly
        expect(await orderStatus(stillPending)).toBe('pending_payment')
    })

    it('expires the remaining payment once the gateway answers again', async () => {
        gateway.pending(gatewayDown.reference)

        const result = await withNowPlus((EXPIRY + 1) * MIN, () => reconcile.execute())

        expect(result).toEqual({...ZERO, checked: 1, expired: 1})
        expect(await status(gatewayDown)).toBe('expired')
    })

    it('has nothing left to do', async () => {
        expect(await withNowPlus((EXPIRY + 1) * MIN, () => reconcile.execute())).toEqual(ZERO)
    })

    it('rejects a callback for an expired payment as "failed"? it stays expired and the gateway is not asked', async () => {
        const before = gateway.verifyCount(stillPending.reference)

        const res = await callbackGet(ctx.app, {trackId: stillPending.reference})

        expect(new URL(res.headers.location as string).searchParams.get('status')).toBe('failed')
        expect(gateway.verifyCount(stillPending.reference)).toBe(before)
        expect(await status(stillPending)).toBe('expired')
    })

    it('runs only once at a time: a parallel run returns an empty result and nothing is processed twice', async () => {
        const target = await open()
        gateway.pending(target.reference)

        const results = await withNowPlus(6 * MIN, () => Promise.all([reconcile.execute(), reconcile.execute()]))

        expect(results.map((r) => r.checked).sort()).toEqual([0, 1])
        expect(results.find((r) => r.checked === 0)).toEqual(ZERO)
        expect(gateway.verifyCount(target.reference)).toBe(1)
    })

    describe('the scheduled job', () => {
        it('runs the reconciliation', async () => {
            const target = await open()
            gateway.approve(target.reference, target.order.total)

            await withNowPlus(6 * MIN, () => ctx.app.get(ReconcilePaymentsJob, {strict: false}).run())

            expect(await status(target)).toBe('paid')
        })

        it('never throws, even when the reconciliation fails', async () => {
            const spy = jest.spyOn(reconcile, 'execute').mockRejectedValueOnce(new Error('boom'))

            await expect(ctx.app.get(ReconcilePaymentsJob, {strict: false}).run()).resolves.toBeUndefined()

            spy.mockRestore()
        })
    })
})
