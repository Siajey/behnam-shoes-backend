import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, randomId, sleep, withNowPlus} from '../../util/test.util'
import {createPublishedProduct} from '../product/product-test.util'
import {getCart, putInCart} from '../cart/cart-test.util'
import {createCoupon} from '../discount/discount-test.util'
import {
    CURRENCY,
    PAYMENT_WINDOW_MS,
    adminStatus,
    createCustomer,
    fillCart,
    getAdminOrder,
    getOrder,
    orderSystemUseCases,
    placeOk,
    shippingFeeFor,
    statusesOf,
} from './order-test.util'

describe('Orders: payment use cases (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let uc: ReturnType<typeof orderSystemUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        uc = orderSystemUseCases(ctx.app)
    })

    const product = (price = 1000) => createPublishedProduct(ctx.app, admin, {variants: [{price, stock: 100}]})

    const shopper = async (price = 1000, quantity = 2) => {
        const p = await product(price)
        const customer = await createCustomer(ctx)
        await fillCart(customer.api, [{variantId: p.variantIds[0], quantity}])
        return {p, customer}
    }

    const couponUsage = async (couponId: string) =>
        (await admin.get(`/admin/coupons/${couponId}/usage`)).json().data

    const notFound = {code: 'ORDER_NOT_FOUND', status: 404}
    const notPayable = (status: string) => ({code: 'ORDER_NOT_PAYABLE', status: 409, details: {status}})

    describe('GetOrderPaymentInfo', () => {
        it('returns what the payment gateway needs', async () => {
            const {customer} = await shopper(1000, 2)
            const order = await placeOk(customer)

            expect(await uc.getPaymentInfo.execute(order.id)).toEqual({
                orderId: order.id,
                orderNumber: order.orderNumber,
                userId: customer.userId,
                amount: 2000 + shippingFeeFor(2000),
                currency: CURRENCY,
                status: 'pending_payment',
                canPay: true,
            })
        })

        it('charges the total after discounts, coupon and shipping', async () => {
            const {customer} = await shopper(1000, 2)
            const coupon = await createCoupon(admin, {value: 10})
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const order = await placeOk(customer)

            const info = await uc.getPaymentInfo.execute(order.id)

            expect(info.amount).toBe(order.total)
            expect(info.amount).toBe(2000 - 200 + shippingFeeFor(1800))
        })

        it('works for any order, whoever owns it, and for finished orders', async () => {
            const {customer} = await shopper()
            const order = await placeOk(customer)
            await customer.api.post(`/orders/${order.id}/cancel`)

            expect(await uc.getPaymentInfo.execute(order.id)).toMatchObject({status: 'cancelled', canPay: false})
        })

        it('reports canPay=false after the payment window even before the expiry job ran', async () => {
            const {customer} = await shopper()
            const order = await placeOk(customer)

            const late = await withNowPlus(PAYMENT_WINDOW_MS + 60_000, () => uc.getPaymentInfo.execute(order.id))
            const early = await withNowPlus(PAYMENT_WINDOW_MS - 60_000, () => uc.getPaymentInfo.execute(order.id))

            expect(late).toMatchObject({status: 'pending_payment', canPay: false})
            expect(early).toMatchObject({status: 'pending_payment', canPay: true})
        })

        it('rejects an unknown order', async () => {
            await expect(uc.getPaymentInfo.execute(randomId())).rejects.toMatchObject(notFound)
        })
    })

    describe('GetPayableOrder', () => {
        it('returns the payment info for the owner of an unpaid order', async () => {
            const {customer} = await shopper()
            const order = await placeOk(customer)

            expect(await uc.getPayable.execute(order.id, customer.userId)).toEqual(
                await uc.getPaymentInfo.execute(order.id),
            )
        })

        it('hides orders of other users behind ORDER_NOT_FOUND', async () => {
            const {customer} = await shopper()
            const stranger = await createCustomer(ctx)
            const order = await placeOk(customer)

            await expect(uc.getPayable.execute(order.id, stranger.userId)).rejects.toMatchObject(notFound)
        })

        it('rejects an unknown order', async () => {
            const customer = await createCustomer(ctx)

            await expect(uc.getPayable.execute(randomId(), customer.userId)).rejects.toMatchObject(notFound)
        })

        it.each(['cancelled', 'paid'])('rejects a %s order with ORDER_NOT_PAYABLE', async (status) => {
            const {customer} = await shopper()
            const order = await placeOk(customer)
            if (status === 'cancelled') await customer.api.post(`/orders/${order.id}/cancel`)
            else await uc.markPaid.execute(order.id)

            await expect(uc.getPayable.execute(order.id, customer.userId)).rejects.toMatchObject(notPayable(status))
        })

        it('rejects an order whose payment window has passed', async () => {
            const {customer} = await shopper()
            const order = await placeOk(customer)

            await expect(
                withNowPlus(PAYMENT_WINDOW_MS + 60_000, () => uc.getPayable.execute(order.id, customer.userId)),
            ).rejects.toMatchObject(notPayable('pending_payment'))
        })
    })

    describe('MarkOrderPaid', () => {
        it('marks a pending order as paid', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)

            await expect(uc.markPaid.execute(placed.id)).resolves.toBeUndefined()

            const order = await getOrder(customer.api, placed.id)
            expect(order).toMatchObject({status: 'paid', canPay: false, paidAt: expect.any(String)})
            expect(statusesOf(order.timeline)).toEqual(['pending_payment', 'paid'])
            const [summary] = (await customer.api.get('/orders')).json().data.items
            expect(summary).toMatchObject({id: placed.id, status: 'paid'})
        })

        it('commits the coupon redemption', async () => {
            const {customer} = await shopper(1000, 1)
            const coupon = await createCoupon(admin, {value: 10, usageLimitTotal: 5})
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const order = await placeOk(customer)
            expect(await couponUsage(coupon.id)).toMatchObject({reserved: 1, committed: 0})

            await uc.markPaid.execute(order.id)

            expect(await couponUsage(coupon.id)).toEqual({reserved: 0, committed: 1, released: 0, totalDiscount: 100})
        })

        it('clears the cart of the payer, including items added after the order was placed', async () => {
            const {p, customer} = await shopper()
            const other = await createCustomer(ctx)
            await fillCart(other.api, [{variantId: p.variantIds[0]}])
            const order = await placeOk(customer)
            const extra = await product()
            await putInCart(customer.api, extra.variantIds[0], 1)

            await uc.markPaid.execute(order.id)

            expect((await getCart(customer.api)).items).toEqual([])
            expect((await getCart(other.api)).items).toHaveLength(1)
        })

        it('also drops the coupon from the cleared cart', async () => {
            const {customer} = await shopper()
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const order = await placeOk(customer)

            await uc.markPaid.execute(order.id)

            expect((await getCart(customer.api)).coupon).toEqual({code: null, status: 'none', invalidReason: null})
        })

        it('is idempotent: paying twice changes nothing', async () => {
            const {customer} = await shopper(1000, 1)
            const coupon = await createCoupon(admin)
            await customer.api.put('/cart/coupon', {code: coupon.code})
            const placed = await placeOk(customer)
            await uc.markPaid.execute(placed.id)
            const first = await getOrder(customer.api, placed.id)
            await sleep(15)

            await expect(uc.markPaid.execute(placed.id)).resolves.toBeUndefined()

            const second = await getOrder(customer.api, placed.id)
            expect(second.paidAt).toBe(first.paidAt)
            expect(second.timeline.filter((e: any) => e.status === 'paid')).toHaveLength(1)
            expect((await couponUsage(coupon.id)).committed).toBe(1)
        })

        it('copes with two parallel payment callbacks', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)

            const results = await Promise.allSettled([uc.markPaid.execute(placed.id), uc.markPaid.execute(placed.id)])

            expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
            const order = await getOrder(customer.api, placed.id)
            expect(order.status).toBe('paid')
            expect(order.timeline.filter((e: any) => e.status === 'paid')).toHaveLength(1)
        })

        it('leaves an order alone that has already progressed beyond paid', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)
            await uc.markPaid.execute(placed.id)
            await adminStatus(admin, placed.id, {action: 'startProcessing'})

            await expect(uc.markPaid.execute(placed.id)).resolves.toBeUndefined()

            expect((await getAdminOrder(admin, placed.id)).status).toBe('processing')
        })

        it('refuses to mark a cancelled order as paid', async () => {
            const {customer} = await shopper()
            const placed = await placeOk(customer)
            await customer.api.post(`/orders/${placed.id}/cancel`)

            await expect(uc.markPaid.execute(placed.id)).rejects.toMatchObject({
                code: 'ORDER_INVALID_STATUS_TRANSITION',
                status: 409,
            })
            expect((await getOrder(customer.api, placed.id)).status).toBe('cancelled')
        })

        it('rejects an unknown order', async () => {
            await expect(uc.markPaid.execute(randomId())).rejects.toMatchObject(notFound)
        })
    })
})
