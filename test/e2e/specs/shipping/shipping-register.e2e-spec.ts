import {afterEach, beforeAll, describe, expect, it,beforeEach} from '@jest/globals'

import {
    IGetShipmentsByOrderIds,
    IListDeliveredOrderIds,
    IRefreshShipment,
    IRegisterShipment
} from '@api/shipping/application'
import {UserRole} from '@api/users/domain'
import {GET_SHIPMENTS_BY_ORDER_IDS, LIST_DELIVERED_ORDER_IDS, REFRESH_SHIPMENT, REGISTER_SHIPMENT} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, randomId} from '../../util/test.util'
import {fakeShippingCarrier, fakeTipax} from '../../util/fake-shipping-carrier'
import {carrierMethods, DAY, iranPostCode, MIN, tipaxCode, trackingEvent, trackingOf} from './shipment-test.util'
import {methodTracker} from "./shipping-test.util";

describe('Shipping: registering shipments (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let methods: Awaited<ReturnType<typeof carrierMethods>>
    let register: IRegisterShipment
    let byOrderIds: IGetShipmentsByOrderIds
    let listDelivered: IListDeliveredOrderIds
    let refresh: IRefreshShipment

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        methods = await carrierMethods(admin)
        const get = <T>(token: symbol) => ctx.app.get<T>(token, {strict: false})
        register = get(REGISTER_SHIPMENT)
        byOrderIds = get(GET_SHIPMENTS_BY_ORDER_IDS)
        listDelivered = get(LIST_DELIVERED_ORDER_IDS)
        refresh = get(REFRESH_SHIPMENT)
    })

    afterEach(() => {
        fakeTipax.reset()
        fakeShippingCarrier.reset()
    })

    const reg = (orderId: string, methodCode: string, trackingCode: string) => register.execute({
        orderId,
        methodCode,
        trackingCode
    })
    const stored = async (orderId: string) => (await byOrderIds.execute([orderId]))[0]

    describe('ListDeliveredOrderIds', () => {
        const deliveredAt = async (when: Date) => {
            const orderId = randomId()
            const code = tipaxCode()
            await reg(orderId, methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('delivered', [trackingEvent(`d-${code}`, 'delivered', when)]))
            await refresh.execute(orderId)
            return orderId
        }

        it('lists the orders delivered since a date, newest delivery first, and respects the limit', async () => {
            const mid = await deliveredAt(new Date(Date.now() - 2 * DAY))
            const old = await deliveredAt(new Date(Date.now() - 20 * DAY))
            const fresh = await deliveredAt(new Date(Date.now() - 60 * MIN))
            const inTransit = randomId()
            await reg(inTransit, methods.tipax.code, tipaxCode())

            const recent = await listDelivered.execute(new Date(Date.now() - 14 * DAY), 100)
            const ours = [old, mid, fresh, inTransit] as Array<string>
            expect(recent.filter((id) => ours.includes(id))).toEqual([fresh, mid])
            expect(await listDelivered.execute(new Date(Date.now() - 30 * DAY), 100)).toEqual(expect.arrayContaining([old, mid, fresh]))
            const list = await listDelivered.execute(new Date(Date.now() - 30 * DAY), 10)
            expect((await listDelivered.execute(new Date(Date.now() - 14 * DAY), 1))).toEqual([fresh])
        })

        it('does not list returned or failed shipments', async () => {
            const orderId = randomId()
            const code = tipaxCode()
            await reg(orderId, methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('returned'))
            await refresh.execute(orderId)

            expect(await listDelivered.execute(new Date(Date.now() - 30 * DAY), 1000)).not.toContain(orderId)
        })
    })

    describe('RegisterShipment', () => {
        it('registers a shipment and describes it', async () => {
            const orderId = randomId()
            const code = tipaxCode()

            const summary = await reg(orderId, methods.tipax.code, code)

            expect(summary).toEqual({
                orderId,
                methodCode: methods.tipax.code,
                carrier: 'tipax',
                trackingCode: code,
                trackingUrl: null,
                autoTracked: true,
                status: 'created',
                deliveredAt: null,
                lastCheckedAt: null,
                events: [],
            })
            expect(await stored(orderId)).toEqual(summary)
        })

        it.each([
            ['tipax', () => tipaxCode(), {trackingUrl: null, autoTracked: true}],
            ['iranPost', () => iranPostCode(), {trackingUrl: 'https://tracking.post.ir/', autoTracked: false}],
            ['fake', () => `f_${Date.now()}`, {trackingUrl: null, autoTracked: true}],
            ['table', () => `T${Date.now()}`, {trackingUrl: null, autoTracked: false}],
        ] as const)('describes a %s shipment (link and auto tracking)', async (kind, code, expected) => {
            const summary = await reg(randomId(), methods[kind].code, code())

            expect(summary).toMatchObject(expected)
            expect(summary.carrier).toBe(methods[kind].carrier)
        })

        it('normalises the code: spaces removed and Persian digits converted', async () => {
            const iran = iranPostCode()
            const persian = iran.replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)))

            expect((await reg(randomId(), methods.iranPost.code, `  ${persian}  `)).trackingCode).toBe(iran)
            expect((await reg(randomId(), methods.table.code, ' AB 12 CD ')).trackingCode).toBe('AB12CD')
        })

        it.each([
            ['tipax', '123'],
            ['tipax', '12345-67890'],
            ['tipax', 'A'.repeat(19)],
            ['tipax', ''],
            ['iranPost', '12345'],
            ['iranPost', `${'1'.repeat(23)}x`],
            ['iranPost', '1'.repeat(25)],
        ] as const)('rejects a %s code of %p and stores nothing', async (kind, code) => {
            const orderId = randomId()

            await expect(reg(orderId, methods[kind].code, code)).rejects.toMatchObject({
                code: 'SHIPPING_INVALID_TRACKING_CODE', status: 400, details: {carrier: methods[kind].carrier},
            })

            expect(await stored(orderId)).toBeUndefined()
        })

        it('rejects an unknown method code', async () => {
            await expect(reg(randomId(), 'no_such_method', 'ABC12345678')).rejects.toMatchObject({
                code: 'SHIPPING_METHOD_NOT_FOUND',
                status: 404
            })
        })

        it('works for a method that was deactivated but not for one that was deleted', async () => {
            const inactive = await methodTracker(admin).create({
                carrier: 'rate_table',
                service: 'post',
                isActive: false
            })
            const deleted = await methodTracker(admin).create({carrier: 'rate_table', service: 'post'})
            await admin.delete(`/admin/shipping-methods/${deleted.id}`)

            await expect(reg(randomId(), inactive.code, 'CODE1234567')).resolves.toMatchObject({carrier: 'rate_table'})
            await expect(reg(randomId(), deleted.code, 'CODE1234567')).rejects.toMatchObject({code: 'SHIPPING_METHOD_NOT_FOUND'})
        })

        describe('registering again for the same order', () => {
            it('changes nothing for the same code and carrier (tracking progress is kept)', async () => {
                const orderId = randomId()
                const code = tipaxCode()
                await reg(orderId, methods.tipax.code, code)
                fakeTipax.setTracking(code, trackingOf('in_transit', [trackingEvent('e1', 'in_transit', new Date())]))
                await refresh.execute(orderId)

                const again = await reg(orderId, methods.tipax.code, ` ${code.toLowerCase().toUpperCase()} `)

                expect(again).toMatchObject({
                    status: 'in_transit',
                    events: [expect.objectContaining({description: 'e1'})]
                })
            })

            it('replaces a wrong code and starts tracking over', async () => {
                const orderId = randomId()
                const [wrong, right] = [tipaxCode(), tipaxCode()]
                await reg(orderId, methods.tipax.code, wrong)
                fakeTipax.setTracking(wrong, trackingOf('in_transit', [trackingEvent('e1', 'in_transit', new Date())]))
                await refresh.execute(orderId)

                const summary = await reg(orderId, methods.tipax.code, right)

                expect(summary).toMatchObject({trackingCode: right, status: 'created', events: [], lastCheckedAt: null})
                expect(await byOrderIds.execute([orderId])).toHaveLength(1)
            })

            it('can move the shipment to another carrier', async () => {
                const orderId = randomId()
                await reg(orderId, methods.tipax.code, tipaxCode())

                const summary = await reg(orderId, methods.iranPost.code, iranPostCode())

                expect(summary).toMatchObject({
                    carrier: 'iran_post',
                    autoTracked: false,
                    trackingUrl: 'https://tracking.post.ir/',
                    status: 'created'
                })
            })

            it('refuses to change a finished shipment, but accepts the same code again', async () => {
                const orderId = randomId()
                const code = tipaxCode()
                await reg(orderId, methods.tipax.code, code)
                fakeTipax.setTracking(code, trackingOf('delivered', [trackingEvent('d', 'delivered', new Date())]))
                await refresh.execute(orderId)

                await expect(reg(orderId, methods.tipax.code, tipaxCode())).rejects.toMatchObject({
                    code: 'SHIPMENT_FINAL',
                    status: 409
                })
                await expect(reg(orderId, methods.tipax.code, code)).resolves.toMatchObject({status: 'delivered'})
                expect((await stored(orderId)).trackingCode).toBe(code)
            })

            it('leaves the old shipment untouched when the new code is invalid', async () => {
                const orderId = randomId()
                const code = tipaxCode()
                await reg(orderId, methods.tipax.code, code)

                await expect(reg(orderId, methods.tipax.code, 'bad')).rejects.toMatchObject({code: 'SHIPPING_INVALID_TRACKING_CODE'})

                expect((await stored(orderId)).trackingCode).toBe(code)
            })
        })

        it('creates a single shipment when the same order is registered in parallel', async () => {
            const orderId = randomId()
            const code = tipaxCode()

            const results = await Promise.allSettled([reg(orderId, methods.tipax.code, code), reg(orderId, methods.tipax.code, code), reg(orderId, methods.tipax.code, code)])

            expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled'])
            expect(await byOrderIds.execute([orderId])).toHaveLength(1)
        })

        it('keeps exactly one shipment when parallel registrations use different codes', async () => {
            const orderId = randomId()
            const [a, b] = [tipaxCode(), tipaxCode()]

            const results = await Promise.allSettled([reg(orderId, methods.tipax.code, a), reg(orderId, methods.tipax.code, b)])

            expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
            const all = await byOrderIds.execute([orderId])
            expect(all).toHaveLength(1)
            expect([a, b]).toContain(all[0].trackingCode)
        })
    })

    describe('GetShipmentsByOrderIds', () => {
        it('returns nothing for an empty list or unknown orders', async () => {
            expect(await byOrderIds.execute([])).toEqual([])
            expect(await byOrderIds.execute([randomId()])).toEqual([])
        })

        it('returns each shipment once, for the requested orders only', async () => {
            const [one, two, other] = [randomId(), randomId(), randomId()]
            await reg(one, methods.tipax.code, tipaxCode())
            await reg(two, methods.iranPost.code, iranPostCode())
            await reg(other, methods.table.code, 'OTHER123456')

            const found = await byOrderIds.execute([one, two, one, randomId()])

            expect(found.map((s) => s.orderId).sort()).toEqual([one, two].sort())
        })

        it('includes the stored events, in time order', async () => {
            const orderId = randomId()
            const code = tipaxCode()
            await reg(orderId, methods.tipax.code, code)
            fakeTipax.setTracking(code, trackingOf('in_transit', [
                trackingEvent('late', 'in_transit', '2030-01-02T10:00:00Z', 'Later', 'B'),
                trackingEvent('early', 'picked_up', '2030-01-01T10:00:00Z', 'Earlier', 'A'),
            ]))
            await refresh.execute(orderId)

            const [summary] = await byOrderIds.execute([orderId])

            expect(summary.events).toEqual([
                {
                    status: 'picked_up',
                    description: 'Earlier',
                    location: 'A',
                    occurredAt: new Date('2030-01-01T10:00:00Z')
                },
                {
                    status: 'in_transit',
                    description: 'Later',
                    location: 'B',
                    occurredAt: new Date('2030-01-02T10:00:00Z')
                },
            ])
        })
    })

})