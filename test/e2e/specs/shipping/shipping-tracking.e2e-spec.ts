import {afterEach, beforeAll, describe, expect, it, jest} from '@jest/globals'

import {IGetShipmentsByOrderIds, IPollShipments, IRegisterShipment} from '@api/shipping/application'
import {ShippingCarrierError} from '@api/shipping/domain'
import {PollShipmentsJob} from '@api/shipping/infrastructure'
import {UserRole} from '@api/users/domain'
import {GET_SHIPMENTS_BY_ORDER_IDS, POLL_SHIPMENTS, REGISTER_SHIPMENT} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    anonymousApi,
    Api,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    UserSession,
    withNowPlus,
} from '../../util/test.util'
import {fakeShippingCarrier, fakeTipax} from '../../util/fake-shipping-carrier'
import {
    backoff,
    carrierMethods,
    INTERVAL,
    iranPostCode,
    MIN,
    tipaxCode,
    trackingEvent,
    trackingOf
} from './shipment-test.util'

const carrierDown = () => new ShippingCarrierError({
    carrier: 'tipax',
    stage: 'track',
    code: 'http_503',
    retryable: true
})

describe('Shipping: tracking jobs and refresh (e2e)', () => {
    let ctx: TestContext
    let adminSession: UserSession
    let admin: Api
    let methods: Awaited<ReturnType<typeof carrierMethods>>
    let register: IRegisterShipment
    let byOrderIds: IGetShipmentsByOrderIds
    let poll: IPollShipments

    beforeAll(async () => {
        ctx = await testContextE2e()
        adminSession = await createUserSession(ctx, UserRole.ADMIN)
        admin = adminSession.api
        methods = await carrierMethods(admin)
        register = ctx.app.get<IRegisterShipment>(REGISTER_SHIPMENT, {strict: false})
        byOrderIds = ctx.app.get<IGetShipmentsByOrderIds>(GET_SHIPMENTS_BY_ORDER_IDS, {strict: false})
        poll = ctx.app.get<IPollShipments>(POLL_SHIPMENTS, {strict: false})
    })

    afterEach(() => {
        fakeTipax.reset()
        fakeShippingCarrier.reset()
    })

    const shipment = async (kind: 'tipax' | 'fake' | 'iranPost' | 'table' = 'tipax') => {
        const orderId = randomId()
        const code = kind === 'tipax' ? tipaxCode() : kind === 'iranPost' ? iranPostCode() : `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        await register.execute({orderId, methodCode: methods[kind].code, trackingCode: code})
        return {orderId, code}
    }
    const stored = async (orderId: string) => (await byOrderIds.execute([orderId]))[0]
    const calls = (code: string) => [...fakeTipax.trackCalls, ...fakeShippingCarrier.trackCalls].filter((c) => c === code).length
    const pollAt = (minutes: number) => withNowPlus(minutes * MIN, () => poll.execute())

    describe('PollShipments', () => {
        it('checks only shipments of carriers that can be tracked and reports the counts', async () => {
            const [a, b] = [await shipment('tipax'), await shipment('tipax')]
            const [iran, table] = [await shipment('iranPost'), await shipment('table')]

            const result = await poll.execute()

            expect(result).toEqual({checked: 2, updated: 0, failed: 0})
            expect([calls(a.code), calls(b.code)]).toEqual([1, 1])
            expect([calls(iran.code), calls(table.code)]).toEqual([0, 0])
            expect((await stored(iran.orderId)).lastCheckedAt).toBeNull()
        })

        it('checks fake-carrier shipments too (any carrier with a track method)', async () => {
            const s = await shipment('fake')

            await poll.execute()

            expect(calls(s.code)).toBe(1)
        })

        it('stores events and moves the status forward', async () => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, trackingOf('in_transit', [
                trackingEvent('b', 'in_transit', '2030-01-02T10:00:00Z', 'Hub', 'Tehran'),
                trackingEvent('a', 'picked_up', '2030-01-01T10:00:00Z', 'Picked up', 'Rasht'),
            ]))

            const result = await poll.execute()
            const after = await stored(s.orderId)

            expect(result.updated).toBeGreaterThanOrEqual(1)
            expect(after).toMatchObject({status: 'in_transit', lastCheckedAt: expect.any(Date)})
            expect(after.events.map((e) => [e.description, e.location])).toEqual([['Picked up', 'Rasht'], ['Hub', 'Tehran']])
        })

        it('checks each shipment once per interval and again when it is due', async () => {
            const s = await shipment()
            await poll.execute()
            expect(calls(s.code)).toBe(1)

            await pollAt(INTERVAL - 1)
            expect(calls(s.code)).toBe(1)

            await pollAt(INTERVAL + 1)
            expect(calls(s.code)).toBe(2)
        })

        it('does not store an event twice and adds only new ones', async () => {
            const s = await shipment()
            const first = trackingEvent('a', 'picked_up', '2030-01-01T10:00:00Z')
            fakeTipax.setTracking(s.code, trackingOf('picked_up', [first]))
            await poll.execute()

            fakeTipax.setTracking(s.code, trackingOf('in_transit', [first, trackingEvent('b', 'in_transit', '2030-01-01T12:00:00Z')]))
            await pollAt(INTERVAL + 1)
            fakeTipax.setTracking(s.code, trackingOf('in_transit', [first, trackingEvent('b', 'in_transit', '2030-01-01T12:00:00Z')]))
            await pollAt(2 * INTERVAL + 2)

            expect((await stored(s.orderId)).events.map((e) => e.description)).toEqual(['a', 'b'])
        })

        it('never moves the status backwards', async () => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, trackingOf('out_for_delivery'))
            await poll.execute()
            fakeTipax.setTracking(s.code, trackingOf('picked_up'))

            await pollAt(INTERVAL + 1)

            expect((await stored(s.orderId)).status).toBe('out_for_delivery')
        })

        it.each(['delivered', 'returned', 'failed'])('stops checking a shipment once it is %s', async (status) => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, trackingOf(status, [trackingEvent('x', status, '2030-01-01T10:00:00Z')]))
            await poll.execute()

            await pollAt(3 * INTERVAL)
            await pollAt(10 * INTERVAL)

            expect(calls(s.code)).toBe(1)
            expect((await stored(s.orderId)).status).toBe(status)
        })

        it('records the delivery time of a delivered shipment', async () => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, trackingOf('delivered', [
                trackingEvent('a', 'in_transit', '2030-01-01T08:00:00Z'),
                trackingEvent('d', 'delivered', '2030-01-01T09:30:00Z'),
            ]))

            await poll.execute()

            expect((await stored(s.orderId)).deliveredAt).toEqual(new Date('2030-01-01T09:30:00Z'))
        })

        it('does not check shipments older than the maximum age (30 days)', async () => {
            const s = await shipment()

            await pollAt(29 * 24 * 60)
            expect(calls(s.code)).toBe(1)

            await pollAt(31 * 24 * 60)
            expect(calls(s.code)).toBe(1)
        })

        describe('when the carrier fails', () => {
            it('counts the failure, keeps the shipment as it was and retries later with a growing delay', async () => {
                const s = await shipment()
                fakeTipax.setTracking(s.code, carrierDown())

                const first = await poll.execute()
                expect(first).toMatchObject({failed: expect.any(Number)})
                expect(first.failed).toBeGreaterThanOrEqual(1)
                expect(calls(s.code)).toBe(1)
                expect((await stored(s.orderId))).toMatchObject({status: 'created', events: [], lastCheckedAt: null})

                await pollAt(backoff(1) - 1) // too early
                expect(calls(s.code)).toBe(1)
                await pollAt(backoff(1) + 1) // second failure
                expect(calls(s.code)).toBe(2)

                await pollAt(backoff(1) + backoff(2) - 1) // the delay doubled
                expect(calls(s.code)).toBe(2)
                await pollAt(backoff(1) + backoff(2) + 2)
                expect(calls(s.code)).toBe(3)
            })

            it('recovers: a successful check resets the delay to the normal interval', async () => {
                const s = await shipment()
                fakeTipax.setTracking(s.code, carrierDown())
                await poll.execute()
                fakeTipax.setTracking(s.code, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z')]))

                const recoverAt = backoff(1) + 1
                await pollAt(recoverAt)
                expect((await stored(s.orderId)).status).toBe('in_transit')

                await pollAt(recoverAt + INTERVAL - 1)
                expect(calls(s.code)).toBe(2) // not due yet
                await pollAt(recoverAt + INTERVAL + 1)
                expect(calls(s.code)).toBe(3)
            })

            it('does not let one failing shipment stop the others', async () => {
                const [down, fine] = [await shipment(), await shipment()]
                fakeTipax.setTracking(down.code, carrierDown())
                fakeTipax.setTracking(fine.code, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z')]))

                await poll.execute()

                expect((await stored(fine.orderId)).status).toBe('in_transit')
                expect((await stored(down.orderId)).status).toBe('created')
            })

            it('does not hide our own errors: the poll fails instead of silently skipping', async () => {
                const s = await shipment()
                fakeTipax.setTracking(s.code, new Error('bug'))

                await expect(poll.execute()).rejects.toThrow('bug')
                expect((await stored(s.orderId)).status).toBe('created')
            })
        })

        it('runs one poll at a time: a parallel poll returns an empty result and nothing is checked twice', async () => {
            const s = await shipment()
            await poll.execute() // not due again right away

            const results = await withNowPlus((INTERVAL + 1) * MIN, () => Promise.all([poll.execute(), poll.execute()]))

            expect(results.map((r) => r.checked).sort((a, b) => a - b)[0]).toBe(0)
            expect(results.find((r) => r.checked === 0)).toEqual({checked: 0, updated: 0, failed: 0})
            expect(calls(s.code)).toBe(2) // once before, once in the parallel run
        })
    })

    describe('POST /admin/shipments/:orderId/refresh', () => {
        const refresh = (orderId: string) => admin.post(`/admin/shipments/${orderId}/refresh`)

        it('checks the carrier now, ignoring the schedule, and returns the updated shipment', async () => {
            const s = await shipment()
            await poll.execute() // just checked: not due for 30 minutes
            fakeTipax.setTracking(s.code, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z', 'Hub', 'Tehran')]))

            const res = await refresh(s.orderId)

            expectOk(res, 200, 'SHIPMENT_REFRESH_SUCCESS')
            expect(res.json().data).toEqual({
                outcome: 'updated',
                shipment: {
                    orderId: s.orderId,
                    methodCode: methods.tipax.code,
                    carrier: 'tipax',
                    trackingCode: s.code,
                    trackingUrl: null,
                    autoTracked: true,
                    status: 'in_transit',
                    deliveredAt: null,
                    lastCheckedAt: expect.any(String),
                    events: [{
                        status: 'in_transit',
                        description: 'Hub',
                        location: 'Tehran',
                        at: '2030-01-01T10:00:00.000Z'
                    }],
                },
            })
        })

        it('answers "unchanged" when the carrier has nothing new, and still moves lastCheckedAt', async () => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, trackingOf('in_transit', [trackingEvent('a', 'in_transit', '2030-01-01T10:00:00Z')]))
            const first = (await refresh(s.orderId)).json().data.shipment.lastCheckedAt

            const res = await refresh(s.orderId)

            expect(res.json().data.outcome).toBe('unchanged')
            expect(new Date(res.json().data.shipment.lastCheckedAt).getTime()).toBeGreaterThanOrEqual(new Date(first).getTime())
        })

        it('answers 200 with "failed" when the carrier is down, and changes nothing', async () => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, carrierDown())

            const res = await refresh(s.orderId)

            expectOk(res, 200, 'SHIPMENT_REFRESH_SUCCESS')
            expect(res.json().data).toMatchObject({
                outcome: 'failed',
                shipment: {status: 'created', events: [], lastCheckedAt: null}
            })
        })

        it.each([
            ['an Iran Post shipment (manual tracking)', () => shipment('iranPost')],
            ['a rate table shipment (no tracking API)', () => shipment('table')],
        ])('answers "skipped" for %s without calling any carrier', async (_label, make) => {
            const s = await make()

            const res = await refresh(s.orderId)

            expect(res.json().data).toMatchObject({
                outcome: 'skipped',
                shipment: {lastCheckedAt: null, status: 'created'}
            })
        })

        it('answers "skipped" for a finished shipment and does not call the carrier again', async () => {
            const s = await shipment()
            fakeTipax.setTracking(s.code, trackingOf('delivered', [trackingEvent('d', 'delivered', '2030-01-01T10:00:00Z')]))
            await refresh(s.orderId)

            const res = await refresh(s.orderId)

            expect(res.json().data).toMatchObject({outcome: 'skipped', shipment: {status: 'delivered'}})
            expect(calls(s.code)).toBe(1)
        })

        it('answers 404 for an order without a shipment and 400 for a malformed id', async () => {
            expectError(await refresh(randomId()), 404, 'SHIPMENT_NOT_FOUND')
            expectValidationError(await admin.post('/admin/shipments/not-a-uuid/refresh'))
        })

        it('is admin only and needs the CSRF header', async () => {
            const s = await shipment()
            const url = `/admin/shipments/${s.orderId}/refresh`

            expect([401, 403]).toContain((await anonymousApi(ctx.app).post(url)).statusCode)
            expect((await (await createUserSession(ctx)).api.post(url)).statusCode).toBe(403)
            expect([401, 403]).toContain((await apiWithoutCsrf(ctx.app, adminSession.session).post(url)).statusCode)
            expect(calls(s.code)).toBe(0)
        })
    })

    describe('PollShipmentsJob', () => {
        // The job reads SHIPPING_TRACKING_ENABLED when it runs. This assumes ConfigProvider reads process.env lazily.
        const withFlag = async (value: string | undefined, fn: () => Promise<void>) => {
            const before = process.env.SHIPPING_TRACKING_ENABLED
            if (value === undefined) delete process.env.SHIPPING_TRACKING_ENABLED
            else process.env.SHIPPING_TRACKING_ENABLED = value
            try {
                await fn()
            } finally {
                if (before === undefined) delete process.env.SHIPPING_TRACKING_ENABLED
                else process.env.SHIPPING_TRACKING_ENABLED = before
            }
        }
        const job = () => ctx.app.get(PollShipmentsJob, {strict: false})

        it.each([[undefined], ['false'], ['TRUE'], ['1'], ['']])('does nothing unless SHIPPING_TRACKING_ENABLED is exactly "true" (%p)', async (value) => {
            const s = await shipment()

            await withFlag(value, () => job().run())

            expect(calls(s.code)).toBe(0)
        })

        it('polls when enabled', async () => {
            const s = await shipment()

            await withFlag('true', () => job().run())

            expect(calls(s.code)).toBe(1)
        })

        it('never throws, even when the poll fails', async () => {
            const spy = jest.spyOn(poll, 'execute').mockRejectedValueOnce(new Error('boom'))

            await withFlag('true', async () => {
                await expect(job().run()).resolves.toBeUndefined()
            })

            spy.mockRestore()
        })
    })
})