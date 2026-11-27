import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {IQuoteShipping} from '@api/shipping/application'
import {UserRole} from '@api/users/domain'
import {QUOTE_SHIPPING} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, expectError, randomId} from '../../util/test.util'
import {fakeShippingCarrier as carrier} from '../../util/fake-shipping-carrier'
import {createPublishedProduct} from '../product/product-test.util'
import {createCustomer, Customer, fillCart} from '../order/order-test.util'
import {
    addAddress,
    AZARBAIJAN_GHARBI,
    GILAN,
    GILAN_ARABIC_YEH,
    ISFAHAN,
    MAHABAD,
    methodTracker,
} from './shipping-test.util'

describe('Shipping: carrier behaviour (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let methods: ReturnType<typeof methodTracker>
    let quote: IQuoteShipping

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        methods = methodTracker(admin)
        quote = ctx.app.get<IQuoteShipping>(QUOTE_SHIPPING, {strict: false})
    })

    afterEach(async () => {
        carrier.reset()
        await methods.cleanup()
    })

    const fake = (overrides: Record<string, unknown> = {}) => methods.create({
        carrier: 'fake',
        service: 'svc',
        ...overrides,
    })
    const destination = (overrides: Record<string, string> = {}) => ({
        postalCode: '1234567890',
        province: ISFAHAN,
        city: 'x',
        ...overrides,
    })
    const lines = (units = 1, unitPrice = 1000) => [{
        variantId: randomId(),
        productId: randomId(),
        quantity: units,
        unitPrice,
    }]
    const run = (methodCode: string, over: Record<string, unknown> = {}) =>
        quote.execute({
            methodCode,
            destination: destination(),
            lines: lines(),
            subtotalAfterDiscounts: 1000,
            ...over,
        } as any)


    describe('in the options list', () => {
        let customer: Customer
        let addressId: string

        beforeAll(async () => {
            const product = await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 100000}]})
            customer = await createCustomer(ctx, {withAddress: false})
            addressId = await addAddress(customer, ISFAHAN)
            await customer.api.delete('/cart')
            await fillCart(customer.api, [{variantId: product.variantIds[0], quantity: 1}])
        })

        const options = async () =>
            (await customer.api.get(`/shipping/options?addressId=${addressId}`)).json().data.options as any[]

        it('keeps the other methods when one carrier is down, marking the broken one unavailable', async () => {
            carrier.failQuotes()
            const [broken, working] = [
                await fake({name: 'Broken', position: 0}),
                await methods.create({
                    service: 'post',
                    carrier: 'rate_table',
                    position: 1,
                }),
            ]

            const list = await options()
            expect(list.find((o) => o.methodCode === broken.code)).toEqual({
                methodCode: broken.code,
                name: 'Broken',
                description: null,
                available: false,
            })
            expect(list.find((o) => o.methodCode === working.code)).toMatchObject({
                available: true,
            })
        })

        it('shows the fallback price as a normal available option', async () => {
            carrier.failQuotes()
            const method = await fake({fallbackFee: 1000})

            expect((await options()).find((o) => o.methodCode === method.code)).toMatchObject({
                available: true,
                fee: 1000,
                estimatedDays: null,
            })
        })

        it('does not hide our own errors: the request fails instead of showing wrong prices', async () => {
            carrier.crashQuotes()
            await fake({fallbackFee: 1000})

            const res = await customer.api.get(`/shipping/options?addressId=${addressId}`)

            expect(res.statusCode).toBeGreaterThanOrEqual(500)
        })
    })

    describe('when the carrier fails', () => {
        it.each([true, false])('uses the fallback fee (retryable=%s) and flags the quote as a fallback', async (retryable) => {
            carrier.failQuotes(retryable)
            const method = await fake({fallbackFee: 1200, handlingFee: 5000})

            expect(await run(method.code)).toMatchObject({
                fee: 1200,
                estimatedDays: null,
                source: 'fallback',
            })
        })

        it('answers SHIPPING_QUOTE_UNAVAILABLE without a fallback fee', async () => {
            carrier.failQuotes()
            const method = await fake()

            await expect(run(method.code)).rejects.toMatchObject({
                code: 'SHIPPING_QUOTE_UNAVAILABLE',
                status: 409,
            })
        })

        it('does not hide our own errors behind the fallback', async () => {
            carrier.crashQuotes()
            const method = await fake({fallbackFee: 1300})

            await expect(run(method.code)).rejects.toThrow('boom')
        })

        it('recovers as soon as the carrier is back (failures are not cached)', async () => {
            const method = await fake({fallbackFee: 1300})
            carrier.failQuotes()
            expect((await run(method.code)).source).toBe('fallback')

            carrier.respondWith(1500)

            expect(await run(method.code)).toMatchObject({
                fee: 1500,
                source: 'carrier',
            })
        })
    })

    describe('a method served by a carrier', () => {
        it('can be created, edited to and from a carrier, and is rejected for unknown carriers', async () => {
            const method = await fake()
            expect(method.carrier).toBe('fake')

            const updatedToTable = await admin.patch(`/admin/shipping-methods/${method.id}`, {
                carrier: 'rate_table',
                service: 'post',
            })
            expect(updatedToTable.json().data.carrier).toBe('rate_table')

            const updatedToFake = await admin.patch(`/admin/shipping-methods/${method.id}`, {
                carrier: 'fake',
            })
            expect(updatedToFake.statusCode).toBe(200)

            expectError(
                await admin.patch(`/admin/shipping-methods/${method.id}`, {carrier: 'unknown_supporter'}),
                400,
                'SHIPPING_CARRIER_NOT_SUPPORTED',
            )
        })

        it('uses the carrier fee plus the handling fee, and its delivery estimate', async () => {
            carrier.respondWith(1800, {min: 2, max: 4})
            const method = await fake({handlingFee: 200})

            expect(await run(method.code)).toMatchObject({
                fee: 2000,
                estimatedDays: {min: 2, max: 4},
                source: 'carrier',
                isFree: false,
            })
        })

        it('passes the carrier the service, the configured origin, a normalised destination and the parcel', async () => {
            const method = await fake({service: 'express_plus'})
            const parcelLines = [
                {variantId: randomId(), productId: randomId(), quantity: 2, unitPrice: 1500},
                {variantId: randomId(), productId: randomId(), quantity: 1, unitPrice: 1000},
            ]

            await run(method.code, {
                lines: parcelLines,
                destination: {
                    postalCode: '\u06F1\u06F2\u06F3\u06F4\u06F5-\u06F6\u06F7\u06F8\u06F9\u06F0',
                    province: GILAN_ARABIC_YEH,
                    city: 'Rasht ',
                },
            })

            expect(carrier.quoteRequests).toEqual([
                {
                    service: 'express_plus',
                    origin: {postalCode: '1234567890', province: AZARBAIJAN_GHARBI, city: MAHABAD},
                    destination: {postalCode: '1234567890', province: GILAN, city: 'Rasht'},
                    parcel: {weightGrams: 3 * 1500 + 500, declaredValue: 4000},
                },
            ])
        })

        it('applies the free-shipping threshold to the carrier fee', async () => {
            carrier.respondWith(1800)
            const method = await fake({freeThreshold: 2000})

            expect(await run(method.code, {subtotalAfterDiscounts: 1999})).toMatchObject({
                fee: 1800,
                isFree: false,
            })
            expect(await run(method.code, {subtotalAfterDiscounts: 2000})).toMatchObject({
                fee: 0,
                isFree: true,
                source: 'carrier',
            })
        })
    })

})