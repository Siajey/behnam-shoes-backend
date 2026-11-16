import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, expectError} from '../../../util/test.util'
import {createPublishedProduct} from '../product/product-test.util'
import {createCoupon} from '../discount/discount-test.util'
import {
    Customer,
    PAYMENT_WINDOW_MS,
    adminStatus,
    createCustomer,
    fillCart,
    getAdminOrder,
    orderSystemUseCases,
    placeOk,
    statusesOf,
    withNowPlus,
} from './order-test.util'


describe('Orders: expiring unpaid orders (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let customer: Customer
    let uc: ReturnType<typeof orderSystemUseCases>
    let coupon: { id: string; code: string }
    let ids: Record<'A' | 'B' | 'F' | 'C' | 'D' | 'E', string>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        uc = orderSystemUseCases(ctx.app)
        const p = await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 500}]})
        customer = await createCustomer(ctx)
        await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 1}])
        coupon = await createCoupon(admin, {value: 10, usageLimitTotal: 1})

        await customer.api.put('/cart/coupon', {code: coupon.code})
        const A = (await placeOk(customer)).id as string
        await customer.api.delete('/cart/coupon')
        const [B, F, C, D, E] = [
            (await placeOk(customer)).id as string,
            (await placeOk(customer)).id as string,
            (await placeOk(customer)).id as string,
            (await placeOk(customer)).id as string,
            (await placeOk(customer)).id as string,
        ]
        await uc.markPaid.execute(C)
        await customer.api.post(`/orders/${D}/cancel`)
        await uc.markPaid.execute(E)
        expect((await adminStatus(admin, E, {action: 'startProcessing'})).statusCode).toBe(200)
        ids = {A, B, F, C, D, E}
    })

    const statusOf = async (id: string) => (await getAdminOrder(admin, id)).status as string
    const slot = async () => (await admin.get(`/admin/coupons/${coupon.id}/usage`)).json().data

    it('does nothing while orders are inside their payment window', async () => {
        expect(await uc.expireUnpaid.execute()).toEqual({expired: 0})
        expect(await withNowPlus(PAYMENT_WINDOW_MS - 60_000, () => uc.expireUnpaid.execute())).toEqual({expired: 0})

        for (const id of [ids.A, ids.B, ids.F]) expect(await statusOf(id)).toBe('pending_payment')
        expect(await slot()).toMatchObject({reserved: 1, released: 0})
    })

    it('expires exactly the unpaid orders once the window has passed', async () => {
        const result = await withNowPlus(
            PAYMENT_WINDOW_MS + 60_000,
            () => uc.expireUnpaid.execute(),
        )

        expect(result).toEqual({expired: 3})

        for (const id of [ids.A, ids.B, ids.F]) {
            expect(await statusOf(id)).toBe('expired')
        }

        expect(await statusOf(ids.C)).toBe('paid')
        expect(await statusOf(ids.D)).toBe('cancelled')
        expect(await statusOf(ids.E)).toBe('processing')
    })

    it('records the expiry in the timeline without an actor', async () => {
        const order = await getAdminOrder(admin, ids.B)

        expect(statusesOf(order.timeline)).toEqual(['pending_payment', 'expired'])
        expect(order.timeline.find((e: any) => e.status === 'expired')).toMatchObject({actorId: null, note: null})
    })

    it('shows expired orders to the customer as not payable', async () => {
        const order = (await customer.api.get(`/orders/${ids.B}`)).json().data

        expect(order).toMatchObject({status: 'expired', canPay: false})
        await expect(uc.getPayable.execute(ids.B, customer.userId)).rejects.toMatchObject({
            code: 'ORDER_NOT_PAYABLE',
            details: {status: 'expired'},
        })
    })

    it('releases the coupon reservation of expired orders', async () => {
        expect(await slot()).toEqual({reserved: 0, committed: 0, released: 1, totalDiscount: 0})
    })

    it('cannot be cancelled by the customer or the admin once expired', async () => {
        expectError(await customer.api.post(`/orders/${ids.B}/cancel`), 409, 'ORDER_INVALID_STATUS_TRANSITION')
        expectError(await adminStatus(admin, ids.B, {action: 'cancel'}), 409, 'ORDER_INVALID_STATUS_TRANSITION')
    })

    it('is idempotent: a second run finds nothing to expire', async () => {
        expect(await withNowPlus(PAYMENT_WINDOW_MS + 120_000, () => uc.expireUnpaid.execute())).toEqual({expired: 0})
    })

    it('still accepts a late payment for an expired order', async () => {
        await uc.markPaid.execute(ids.F)

        const order = await getAdminOrder(admin, ids.F)
        expect(order).toMatchObject({status: 'paid', paidAt: expect.any(String)})
        expect(statusesOf(order.timeline)).toEqual(['pending_payment', 'paid','expired'])
    })

    it('lets a late-paid order continue through the normal flow', async () => {
        expect((await adminStatus(admin, ids.F, {action: 'startProcessing'})).statusCode).toBe(200)
        expect(await statusOf(ids.F)).toBe('processing')
    })
})
