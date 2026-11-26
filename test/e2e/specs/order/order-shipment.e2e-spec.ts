import {afterEach, beforeAll, describe, expect, it, jest} from '@jest/globals'

import {ISyncShipmentStatuses} from '@api/order/application'
import {SyncShipmentStatusesJob} from '@api/order/infrastructure'
import {IPollShipments} from '@api/shipping/application'
import {UserRole} from '@api/users/domain'
import {POLL_SHIPMENTS, SYNC_SHIPMENT_STATUSES} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    expectError,
    expectValidationError,
    randomId,
    UserSession
} from '../../util/test.util'
import {fakeTipax} from '../../util/fake-shipping-carrier'
import {createPublishedProduct} from '../product/product-test.util'
import {
    adminStatus,
    createCustomer,
    Customer,
    fillCart,
    getAdminOrder,
    getOrder,
    placeOk,
    statusesOf
} from './order-test.util'
import {ensureShippingMethods, methodTracker} from '../shipping/shipping-test.util'
import {
    carrierMethods,
    DAY,
    iranPostCode,
    processingOrder,
    shippedOrder,
    tipaxCode,
    trackingEvent,
    trackingOf
} from '../shipping/shipment-test.util'

describe('Orders: shipments and tracking (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let customer: Customer
    let variantId: string
    let methods: Awaited<ReturnType<typeof carrierMethods>>
    let tracker: ReturnType<typeof methodTracker>
    let poll: IPollShipments
    let sync: ISyncShipmentStatuses

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        tracker = methodTracker(admin)
        await ensureShippingMethods(admin)
        methods = await carrierMethods(admin)
        variantId = (await createPublishedProduct(ctx.app, admin, {
            variants: [{
                price: 1000,
                stock: 100000
            }]
        })).variantIds[0]
        customer = await createCustomer(ctx)
        poll = ctx.app.get<IPollShipments>(POLL_SHIPMENTS, {strict: false})
        sync = ctx.app.get<ISyncShipmentStatuses>(SYNC_SHIPMENT_STATUSES, {strict: false})
    })

    afterEach(async () => {
        fakeTipax.reset()
        await tracker.cleanup()
    })

    const processing = (code: string) => processingOrder(ctx.app, admin, customer, variantId, code)
    const shipped = (methodCode: string, trackingCode: string) => shippedOrder(ctx.app, admin, customer, variantId, methodCode, trackingCode)
    const ship = (id: string, body: Record<string, unknown> = {}) => adminStatus(admin, id, {action: 'ship', ...body})
    const status = async (id: string) => (await getAdminOrder(admin, id)).status as string

    describe('shipping with a tracking code', () => {
        it('registers the shipment for the order carrier and ships the order', async () => {
            const id = await processing(methods.tipax.code)
            const code = tipaxCode()

            const res = await ship(id, {trackingCode: code})

            expect(res.statusCode).toBe(200)
            expect(res.json().data).toMatchObject({status: 'shipped', shipment: {carrier: 'tipax', trackingCode: code}})
            expect((await getAdminOrder(admin, id)).tracking).toEqual({
                carrier: 'tipax', trackingCode: code, trackingUrl: null, autoTracked: true,
                status: 'created', deliveredAt: null, events: [],
            })
        })

        it('shows the tracking block to the customer, with events once the carrier reports them', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z', 'Arrived at hub', 'Tehran')]))
            await poll.execute()

            const order = await getOrder(customer.api, id)

            expect(order.tracking).toEqual({
                carrier: 'tipax',
                trackingCode: code,
                trackingUrl: null,
                autoTracked: true,
                status: 'in_transit',
                deliveredAt: null,
                events: [{
                    status: 'in_transit',
                    description: 'Arrived at hub',
                    location: 'Tehran',
                    at: '2030-01-01T10:00:00.000Z'
                }],
            })
            expect((await getAdminOrder(admin, id)).tracking).toEqual(order.tracking)
        })

        it('gives Iran Post orders the portal link and no automatic tracking', async () => {
            const code = iranPostCode()
            const id = await shipped(methods.iranPost.code, code)

            expect((await getOrder(customer.api, id)).tracking).toEqual({
                carrier: 'iran_post', trackingCode: code, trackingUrl: 'https://tracking.post.ir/', autoTracked: false,
                status: 'created', deliveredAt: null, events: [],
            })
        })

        it('normalises the code and records the carrier name, not the free text sent', async () => {
            const id = await processing(methods.table.code)

            const res = await ship(id, {carrier: 'Whatever', trackingCode: '  AB 12  '})

            expect(res.json().data.shipment).toEqual({carrier: 'rate_table', trackingCode: 'AB12'})
        })

        it.each([
            ['a Tipax code that is too short', () => methods.tipax.code, '123'],
            ['a Tipax code with a dash', () => methods.tipax.code, '12345-67890'],
            ['an Iran Post code of 23 digits', () => methods.iranPost.code, '1'.repeat(23)],
            ['an Iran Post code with letters', () => methods.iranPost.code, `${'1'.repeat(23)}a`],
        ])('rejects %s and leaves the order in processing without a shipment', async (_label, method, code) => {
            const id = await processing(method())

            expectError(await ship(id, {trackingCode: code}), 400, 'SHIPPING_INVALID_TRACKING_CODE')

            expect(await status(id)).toBe('processing')
            expect((await getAdminOrder(admin, id)).tracking).toBeNull()
            expect(fakeTipax.trackCalls).toEqual([])
        })

        it('does not accept a tracking code that is too long for storage as a server error', async () => {
            const id = await processing(methods.table.code)

            const res = await ship(id, {trackingCode: 'x'.repeat(65)})

            expect(res.statusCode).toBe(400)
            expect(await status(id)).toBe('processing')
        })

        it('rejects shipping with a code when the method was deleted, leaving the order unchanged', async () => {
            const method = await tracker.create({carrier: 'rate_table', service: 'post'})
            const id = await processing(method.code)
            await admin.delete(`/admin/shipping-methods/${method.id}`)

            expectError(await ship(id, {trackingCode: 'CODE1234567'}), 404, 'SHIPPING_METHOD_NOT_FOUND')

            expect(await status(id)).toBe('processing')
        })

        it('still works when the method was only deactivated after the order was placed', async () => {
            const method = await tracker.create({carrier: 'rate_table', service: 'post'})
            const id = await processing(method.code)
            await admin.patch(`/admin/shipping-methods/${method.id}`, {isActive: false})

            expect((await ship(id, {trackingCode: 'CODE1234567'})).statusCode).toBe(200)
        })

        it('still ships without a code (no shipment, no tracking), keeping the carrier text', async () => {
            const id = await processing(methods.tipax.code)

            const res = await ship(id, {carrier: 'Courier'})

            expect(res.json().data).toMatchObject({
                status: 'shipped',
                shipment: {carrier: 'Courier', trackingCode: null}
            })
            expect((await getAdminOrder(admin, id)).tracking).toBeNull()
        })

        it('has no tracking block before shipping, in the place response or in the detail', async () => {
            await customer.api.delete('/cart')
            await customer.api.post('/cart/items', {variantId, quantity: 1})
            const placed = await placeOk(customer, {shippingMethod: methods.tipax.code})

            expect(placed.tracking ?? null).toBeNull()
            expect((await getOrder(customer.api, placed.id)).tracking).toBeNull()
            expect((await getAdminOrder(admin, placed.id)).tracking).toBeNull()
        })

        it('is not part of the order list summaries', async () => {
            await shipped(methods.tipax.code, tipaxCode())

            const items = (await customer.api.get('/orders?pageSize=100')).json().data.items as any[]

            for (const item of items) expect(item).not.toHaveProperty('tracking')
        })
    })

    describe('action updateTracking', () => {
        const update = (id: string, body: Record<string, unknown>) => adminStatus(admin, id, {action: 'updateTracking', ...body})

        it('replaces a wrong code on a shipped order, keeps the status and starts tracking over', async () => {
            const [wrong, right] = [tipaxCode(), tipaxCode()]
            const id = await shipped(methods.tipax.code, wrong)
            fakeTipax.setTracking(wrong, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z')]))
            await poll.execute()

            const res = await update(id, {trackingCode: right, note: 'Fixed typo'})

            expect(res.statusCode).toBe(200)
            expect(res.json().data).toMatchObject({
                status: 'shipped',
                shipment: {carrier: 'tipax', trackingCode: right}
            })
            expect((await getOrder(customer.api, id)).tracking).toMatchObject({
                trackingCode: right,
                status: 'created',
                events: []
            })
        })

        it('does nothing visible when the same code is sent again, and keeps the progress', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z')]))
            await poll.execute()

            expect((await update(id, {trackingCode: code})).statusCode).toBe(200)

            expect((await getOrder(customer.api, id)).tracking).toMatchObject({
                status: 'in_transit',
                events: [expect.anything()]
            })
        })

        it('validates the new code with the carrier rule and keeps the old one', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)

            expectError(await update(id, {trackingCode: 'bad'}), 400, 'SHIPPING_INVALID_TRACKING_CODE')

            expect((await getOrder(customer.api, id)).tracking.trackingCode).toBe(code)
        })

        it('adds a shipment to an order that was shipped without a code', async () => {
            const id = await processing(methods.tipax.code)
            await ship(id)
            const code = tipaxCode()

            expect((await update(id, {trackingCode: code})).statusCode).toBe(200)

            expect((await getOrder(customer.api, id)).tracking).toMatchObject({carrier: 'tipax', trackingCode: code})
        })

        it.each(['paid', 'processing', 'delivered'])('is only possible for shipped orders (not %s)', async (state) => {
            const id = await processing(methods.tipax.code)
            if (state === 'paid') {
                await fillCart(customer.api,[{
                    variantId
                }])
                const other = await placeOk(customer, {shippingMethod: methods.tipax.code})
                await (await import('./order-test.util')).orderSystemUseCases(ctx.app).markPaid.execute(other.id)
                expectError(await update(other.id, {trackingCode: tipaxCode()}), 409, 'ORDER_INVALID_STATUS_TRANSITION')
                return
            }
            if (state === 'delivered') {
                await ship(id)
                await adminStatus(admin, id, {action: 'deliver'})
            }

            expectError(await update(id, {trackingCode: tipaxCode()}), 409, 'ORDER_INVALID_STATUS_TRANSITION')
            expect(await status(id)).toBe(state)
        })

        it('is refused with SHIPMENT_FINAL once the carrier reports the parcel delivered, and leaves the order alone', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('delivered', [trackingEvent('d', 'delivered', new Date())]))
            await poll.execute()

            expectError(await update(id, {trackingCode: tipaxCode()}), 409, 'SHIPMENT_FINAL')

            expect((await getAdminOrder(admin, id)).tracking.trackingCode).toBe(code)
            expect(await status(id)).toBe('shipped')
        })

        it.each([
            ['a missing code', {}],
            ['a blank code', {trackingCode: '   '}],
            ['a code over 64 characters', {trackingCode: 'x'.repeat(65)}],
            ['a note over 500 characters', {trackingCode: 'ABCDEFGHIJ12', note: 'n'.repeat(501)}],
        ])('rejects %s', async (_label, body) => {
            const id = await shipped(methods.tipax.code, tipaxCode())

            expectValidationError(await update(id, body))
        })

        it('answers 404 for an unknown order and 400 for a malformed id', async () => {
            expectError(await update(randomId(), {trackingCode: tipaxCode()}), 404, 'ORDER_NOT_FOUND')
            expectValidationError(await adminStatus(admin, 'not-a-uuid', {
                action: 'updateTracking',
                trackingCode: tipaxCode()
            }))
        })
    })

    describe('SyncShipmentStatuses: delivery from tracking', () => {
        const deliveredBy = async (code: string, when: Date = new Date()) => {
            fakeTipax.setTracking(code, trackingOf('delivered', [
                trackingEvent('a', 'in_transit', new Date(when.getTime() - 3_600_000)),
                trackingEvent('d', 'delivered', when),
            ]))
            await poll.execute()
        }

        it('marks the order delivered once the carrier reports delivery, by the system and not an admin', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            await deliveredBy(code)

            const result = await sync.execute()

            expect(result.delivered).toBeGreaterThanOrEqual(1)
            const order = await getAdminOrder(admin, id)
            expect(order.status).toBe('delivered')
            expect(statusesOf(order.timeline)).toEqual(['pending_payment', 'paid', 'processing', 'shipped', 'delivered'])
            expect(order.timeline.find((e: any) => e.status === 'delivered')).toMatchObject({actorId: null})
            expect(order.tracking).toMatchObject({status: 'delivered', deliveredAt: expect.any(String)})
            expect((await getOrder(customer.api, id)).status).toBe('delivered')
        })

        it('does nothing until the carrier reports delivery', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('out_for_delivery'))
            await poll.execute()

            await sync.execute()

            expect(await status(id)).toBe('shipped')
        })

        it('is idempotent', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            await deliveredBy(code)
            await sync.execute()

            expect((await sync.execute()).delivered).toBe(0)

            expect((await getAdminOrder(admin, id)).timeline.filter((e: any) => e.status === 'delivered')).toHaveLength(1)
        })

        it('leaves an order alone that an admin already marked delivered', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            expect((await adminStatus(admin, id, {action: 'deliver'})).statusCode).toBe(200)
            await deliveredBy(code)

            await sync.execute()

            const order = await getAdminOrder(admin, id)
            expect(order.timeline.filter((e: any) => e.status === 'delivered')).toHaveLength(1)
            expect(order.timeline.find((e: any) => e.status === 'delivered').actorId).toBe(adminSession.userId)
        })

        it.each(['returned', 'failed'])('does not deliver an order whose parcel was %s (an admin decides)', async (final) => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf(final, [trackingEvent('x', final, new Date())]))
            await poll.execute()

            await sync.execute()

            expect(await status(id)).toBe('shipped')
            expect((await getAdminOrder(admin, id)).tracking.status).toBe(final)
        })

        it('ignores deliveries older than the 14 day look-back (by the carrier delivery time)', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            await deliveredBy(code, new Date(Date.now() - 20 * DAY))

            await sync.execute()

            expect(await status(id)).toBe('shipped')
        })

        it('never marks Iran Post or unshipped orders delivered', async () => {
            const iran = await shipped(methods.iranPost.code, iranPostCode())
            const ready = await processing(methods.tipax.code)

            await sync.execute()

            expect(await status(iran)).toBe('shipped')
            expect(await status(ready)).toBe('processing')
        })

        it('handles several deliveries in one run', async () => {
            const codes = [tipaxCode(), tipaxCode(), tipaxCode()]
            const ids: string[] = []
            for (const code of codes) ids.push(await shipped(methods.tipax.code, code))
            for (const code of codes) fakeTipax.setTracking(code, trackingOf('delivered', [trackingEvent(`d-${code}`, 'delivered', new Date())]))
            await poll.execute()

            const result = await sync.execute()

            expect(result.delivered).toBeGreaterThanOrEqual(3)
            for (const id of ids) expect(await status(id)).toBe('delivered')
        })
    })

    describe('SyncShipmentStatusesJob', () => {
        const job = () => ctx.app.get(SyncShipmentStatusesJob, {strict: false})

        it('runs the sync', async () => {
            const code = tipaxCode()
            const id = await shipped(methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('delivered', [trackingEvent('d', 'delivered', new Date())]))
            await poll.execute()

            await job().run()

            expect(await status(id)).toBe('delivered')
        })

        it('never throws, even when the sync fails', async () => {
            const spy = jest.spyOn(sync, 'execute').mockRejectedValueOnce(new Error('boom'))

            await expect(job().run()).resolves.toBeUndefined()

            spy.mockRestore()
        })
    })
})