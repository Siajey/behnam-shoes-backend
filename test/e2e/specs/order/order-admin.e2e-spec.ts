import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    UserSession,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    qs,
    randomId,
    sleep,
    walkPages, withNowPlus,
} from '../../util/test.util'
import {createPublishedProduct, imageKeyOf} from '../product/product-test.util'
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
    shippingFeeFor,
    statusesOf,
} from './order-test.util'

type Status = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'expired'

describe('Orders: admin (e2e)', () => {
    let ctx: TestContext
    let adminUser: UserSession
    let customer: Customer
    let uc: ReturnType<typeof orderSystemUseCases>
    let variant: { sku: string; source: string; externalId: string; id: string }
    let productId: string

    const seeded: Record<Status, string> = {} as Record<Status, string>
    const seededOrder: Status[] = ['expired', 'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']
    let startedAt: Date

    const admin = () => adminUser.api

    const move = async (id: string, body: Record<string, unknown>) => {
        const res = await adminStatus(admin(), id, body)
        expect(res.statusCode).toBe(200)
    }

    const orderIn = async (status: Exclude<Status, 'expired'>): Promise<string> => {
        const p = await createPublishedProduct(ctx.app, admin(), {variants: [{price: 1000, stock: 500}]})
        await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 2}])
        const id = (await placeOk(customer)).id as string
        if (status === 'pending_payment') return id
        if (status === 'cancelled') {
            expect((await customer.api.post(`/orders/${id}/cancel`)).statusCode).toBe(200)
            return id
        }
        await uc.markPaid.execute(id)
        if (status === 'paid') return id
        await move(id, {action: 'startProcessing'})
        if (status === 'processing') return id
        await move(id, {action: 'ship', carrier: 'Post', trackingCode: 'TRK1'})
        if (status === 'shipped') return id
        await move(id, {action: 'deliver'})
        return id
    }

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminUser = await createUserSession(ctx, UserRole.ADMIN)
        uc = orderSystemUseCases(ctx.app)
        const p = await createPublishedProduct(ctx.app, admin(), {variants: [{price: 1000, stock: 500}]})
        productId = p.id
        variant = p.variants[0] as any
        customer = await createCustomer(ctx)
        await fillCart(customer.api, [{variantId: p.variantIds[0], quantity: 2}])

        startedAt = new Date()
        seeded.expired = (await placeOk(customer)).id
        expect((await withNowPlus(PAYMENT_WINDOW_MS + 60_000, () => uc.expireUnpaid.execute())).expired).toBe(1)
        for (const status of seededOrder.slice(1) as Exclude<Status, 'expired'>[]) {
            seeded[status] = await orderIn(status)
            await sleep(5)
        }
    })

    const seededIds = () => new Set(Object.values(seeded))
    const listIds = async (params: Record<string, any> = {}) => {
        const res = await admin().get(`/admin/orders${qs({pageSize: 100, ...params})}`)
        expectOk(res, 200, 'ORDER_LIST_SUCCESS')
        return (res.json().data.items as any[]).filter((o) => seededIds().has(o.id)).map((o) => o.id as string)
    }

    describe('GET /admin/orders', () => {
        it('lists orders newest first with the admin summary shape', async () => {
            const items = (await admin().get('/admin/orders?pageSize=100')).json().data.items as any[]
            const mine = items.filter((o) => seededIds().has(o.id))

            expect(mine.map((o) => o.id)).toEqual(seededOrder.map((s) => seeded[s]).reverse())
            expect(mine[0]).toEqual({
                id: seeded.cancelled,
                orderNumber: expect.any(Number),
                status: 'cancelled',
                itemCount: 2,
                total: 2000 + shippingFeeFor(2000),
                currency: expect.any(String),
                previewImageKey: expect.any(String),
                previewImageUrl: expect.any(String),
                createdAt: expect.any(String),
                paidAt: null,
                userId: customer.userId,
                recipient: 'Sara Ahmadi',
            })
        })

        it.each([
            ['paid', ['paid']],
            ['paid,delivered', ['paid', 'delivered']],
            [' shipped , processing ', ['processing', 'shipped']],
            ['pending_payment,expired,cancelled', ['pending_payment', 'expired', 'cancelled']],
        ])('filters by statuses=%p', async (statuses, expected) => {
            const ids = await listIds({statuses})

            expect([...ids].sort()).toEqual((expected as Status[]).map((s) => seeded[s]).sort())
        })

        it('treats an empty statuses value as no filter', async () => {
            expect(await listIds({statuses: ''})).toHaveLength(seededOrder.length)
        })

        it('filters by orderNumber', async () => {
            const detail = await getAdminOrder(admin(), seeded.paid)

            const res = await admin().get(`/admin/orders${qs({orderNumber: detail.orderNumber})}`)

            expect(res.json().data.items.map((o: any) => o.id)).toEqual([seeded.paid])
            const none = await admin().get(`/admin/orders${qs({orderNumber: 999999999})}`)
            expect(none.json().data.items).toEqual([])
        })

        it('filters by creation date range', async () => {
            const before = new Date(startedAt.getTime() - 60_000).toISOString()
            const future = new Date(Date.now() + 86_400_000).toISOString()
            const past = new Date(startedAt.getTime() - 1000).toISOString()

            expect(await listIds({from: before})).toHaveLength(seededOrder.length)
            expect(await listIds({from: future})).toEqual([])
            expect(await listIds({to: past})).toEqual([])
            expect(await listIds({to: future})).toHaveLength(seededOrder.length)
            expect(await listIds({from: before, to: future, statuses: 'paid'})).toEqual([seeded.paid])
        })

        it('walks pages without gaps or duplicates', async () => {
            const full = (await admin().get('/admin/orders?pageSize=100')).json().data.items.map((o: any) => o.id)

            const pages = await walkPages(admin(), '/admin/orders', {pageSize: 3})

            expect(pages.flatMap((p) => p.items.map((o: any) => o.id))).toEqual(full)
            expect(pages[pages.length - 1].nextCursor).toBeNull()
        })

        it.each([
            ['statuses=bogus', {statuses: 'bogus'}],
            ['statuses=paid,bogus', {statuses: 'paid,bogus'}],
            ['orderNumber=0', {orderNumber: 0}],
            ['orderNumber=abc', {orderNumber: 'abc'}],
            ['orderNumber=1.5', {orderNumber: 1.5}],
            ['from=yesterday', {from: 'yesterday'}],
            ['to=2030-01-01', {to: 'soon'}],
            ['pageSize=0', {pageSize: 0}],
            ['pageSize=101', {pageSize: 101}],
        ])('rejects %s', async (_label, params) => {
            expectValidationError(await admin().get(`/admin/orders${qs(params as any)}`))
        })
    })

    describe('GET /admin/orders/:id', () => {
        it('returns the admin detail with internal line fields and the actor of each event', async () => {
            const order = await getAdminOrder(admin(), seeded.processing)

            expect(order).toMatchObject({id: seeded.processing, status: 'processing', userId: customer.userId})
            expect(order.lines[0]).toMatchObject({
                variantId: expect.any(String),
                sku: expect.any(String),
                externalSource: expect.any(String),
                externalId: expect.any(String),
                quantity: 2,
                lineTotal: 2000,
            })
            const byStatus = Object.fromEntries(order.timeline.map((e: any) => [e.status, e]))
            expect(byStatus.pending_payment.actorId).toBeNull()
            expect(byStatus.paid.actorId).toBeNull()
            expect(byStatus.processing.actorId).toBe(adminUser.userId)
        })

        it('returns orders of any customer', async () => {
            const order = await getAdminOrder(admin(), seeded.pending_payment)

            expect(order.userId).toBe(customer.userId)
            expect(order.canPay).toBe(true)
        })

        it('answers 404 for an unknown order and 400 for a malformed id', async () => {
            expectError(await admin().get(`/admin/orders/${randomId()}`), 404, 'ORDER_NOT_FOUND')
            expectValidationError(await admin().get('/admin/orders/not-a-uuid'))
        })
    })

    describe('POST /admin/orders/:id/status', () => {
        type Action = 'startProcessing' | 'ship' | 'deliver' | 'cancel'
        const target: Record<Action, Status> = {startProcessing: 'processing', ship: 'shipped', deliver: 'delivered', cancel: 'cancelled'}
        const allowed: Record<Status, Action[]> = {
            pending_payment: ['cancel'],
            paid: ['startProcessing', 'cancel'],
            processing: ['ship', 'cancel'],
            shipped: ['deliver'],
            delivered: [],
            cancelled: [],
            expired: [],
        }
        const cases = (Object.keys(allowed) as Status[]).flatMap((from) =>
            (['startProcessing', 'ship', 'deliver', 'cancel'] as Action[]).map((action) => [from, action] as const),
        )

        it.each(cases)('%s + %s', async (from, action) => {
            const id = from === 'expired' ? seeded.expired : await orderIn(from)

            const res = await adminStatus(admin(), id, {action})

            if (allowed[from].includes(action)) {
                expectOk(res, 200, 'ORDER_STATUS_UPDATE_SUCCESS')
                expect(res.json().data.status).toBe(target[action])
                expect((await getAdminOrder(admin(), id)).status).toBe(target[action])
            } else {
                expectError(res, 409, 'ORDER_INVALID_STATUS_TRANSITION')
                expect((await getAdminOrder(admin(), id)).status).toBe(from)
            }
        })

        it('records every step in the timeline with the admin as actor and the note', async () => {
            const id = await orderIn('paid')

            await move(id, {action: 'startProcessing', note: 'Packing now'})
            await move(id, {action: 'ship', carrier: 'Post', trackingCode: 'TRK-9', note: 'Handed to courier'})
            await move(id, {action: 'deliver'})

            const order = await getAdminOrder(admin(), id)
            expect(statusesOf(order.timeline)).toEqual(['pending_payment', 'paid', 'processing', 'shipped', 'delivered'])
            const events = Object.fromEntries(order.timeline.map((e: any) => [e.status, e]))
            expect(events.processing).toMatchObject({note: 'Packing now', actorId: adminUser.userId})
            expect(events.shipped).toMatchObject({note: 'Handed to courier', actorId: adminUser.userId})
            expect(events.delivered).toMatchObject({note: null, actorId: adminUser.userId})
        })

        describe('shipping details', () => {
            it('stores carrier and tracking code', async () => {
                const id = await orderIn('processing')

                const res = await adminStatus(admin(), id, {action: 'ship', carrier: '  Chapar ', trackingCode: ' ABC123 '})

                expect(res.json().data.shipment).toEqual({carrier: 'Chapar', trackingCode: 'ABC123'})
                expect((await getAdminOrder(admin(), id)).shipment).toEqual({carrier: 'Chapar', trackingCode: 'ABC123'})
            })

            it('allows shipping without them', async () => {
                const id = await orderIn('processing')

                const res = await adminStatus(admin(), id, {action: 'ship'})

                expect(res.json().data.shipment).toEqual({carrier: null, trackingCode: null})
            })

            it('shows the shipment to the customer', async () => {
                const id = await orderIn('processing')
                await move(id, {action: 'ship', carrier: 'Post', trackingCode: 'TRK-CUST'})

                const order = (await customer.api.get(`/orders/${id}`)).json().data

                expect(order.shipment).toEqual({carrier: 'Post', trackingCode: 'TRK-CUST'})
            })
        })

        describe('coupons', () => {
            const withCoupon = async () => {
                const coupon = await createCoupon(admin(), {value: 10})
                const buyer = await createCustomer(ctx)
                await fillCart(buyer.api, [{variantId: variant.id, quantity: 1}])
                await buyer.api.put('/cart/coupon', {code: coupon.code})
                const order = await placeOk(buyer)
                const usage = async () => (await admin().get(`/admin/coupons/${coupon.id}/usage`)).json().data
                return {order, usage}
            }

            it('cancelling an unpaid order releases the coupon', async () => {
                const {order, usage} = await withCoupon()
                expect(await usage()).toMatchObject({reserved: 1, released: 0})

                await move(order.id, {action: 'cancel'})

                expect(await usage()).toEqual({reserved: 0, committed: 0, released: 1, totalDiscount: 0})
            })

            it('cancelling a paid order keeps the committed redemption', async () => {
                const {order, usage} = await withCoupon()
                await uc.markPaid.execute(order.id)
                expect(await usage()).toMatchObject({committed: 1})

                await move(order.id, {action: 'cancel'})

                expect(await usage()).toMatchObject({committed: 1, released: 0})
            })
        })

        describe('validation', () => {
            it.each([
                ['a missing action', {}],
                ['an unknown action', {action: 'refund'}],
                ['an action in the wrong case', {action: 'StartProcessing'}],
                ['a note over 500 characters', {action: 'cancel', note: 'n'.repeat(501)}],
                ['an empty note', {action: 'deliver', note: ''}],
                ['an empty carrier', {action: 'ship', carrier: ''}],
                ['a carrier over 100 characters', {action: 'ship', carrier: 'c'.repeat(101)}],
                ['an empty tracking code', {action: 'ship', trackingCode: '  '}],
                ['a tracking code over 100 characters', {action: 'ship', trackingCode: 't'.repeat(101)}],
            ])('rejects %s', async (_label, body) => {
                const id = await orderIn('processing')

                expectValidationError(await adminStatus(admin(), id, body))
                expect((await getAdminOrder(admin(), id)).status).toBe('processing')
            })

            it('accepts null notes and ignores shipping fields on other actions', async () => {
                const id = await orderIn('paid')

                const res = await adminStatus(admin(), id, {action: 'startProcessing', note: null, carrier: 'ignored'})

                expect(res.statusCode).toBe(200)
                expect(res.json().data.shipment).toEqual({carrier: null, trackingCode: null})
            })

            it('answers 404 for an unknown order and 400 for a malformed id', async () => {
                expectError(await adminStatus(admin(), randomId(), {action: 'cancel'}), 404, 'ORDER_NOT_FOUND')
                expectValidationError(await adminStatus(admin(), 'not-a-uuid', {action: 'cancel'}))
            })
        })
    })
})
