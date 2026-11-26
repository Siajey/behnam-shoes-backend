import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {IQuoteShipping} from '@api/shipping/application'
import {UserRole} from '@api/users/domain'
import {QUOTE_SHIPPING} from '@common/di'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, expectError, randomId} from '../../util/test.util'
import {GILAN, ISFAHAN, methodTracker} from './shipping-test.util'

describe('Shipping: quote calculation (e2e)', () => {
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
        await methods.cleanup()
    })

    const destination = (overrides: Record<string, string> = {}) => ({
        postalCode: '1234567890',
        province: ISFAHAN,
        city: 'Isfahan',
        ...overrides,
    })

    const line = (quantity = 1, unitPrice = 10000) => ({
        variantId: randomId(),
        productId: randomId(),
        quantity,
        unitPrice,
    })

    const run = (methodCode: string, overrides: Record<string, unknown> = {}) =>
        quote.execute({
            methodCode,
            destination: destination(),
            lines: [line()],
            subtotalAfterDiscounts: 10000,
            ...overrides,
        } as any)

    it('prices by the total number of units in all lines', async () => {
        const method = await methods.create({carrier: 'rate_table', service: 'post'})
        const mixed = [line(1, 10000), line(2, 10000)]

        expect((await run(method.code, {lines: mixed})).fee).toBe(1400)
    })

    it('uses same-province base fee when origin and destination share province', async () => {
        const method = await methods.create({carrier: 'rate_table', service: 'post'})

        const result = await run(method.code, {
            destination: destination({province: GILAN}),
            lines: [line(1)],
        })

        expect(result).toMatchObject({
            methodCode: method.code,
            fee: 1100,
            isFree: false,
            estimatedDays: {min: 2, max: 4},
            source: 'carrier',
        })
    })

    it('applies free shipping threshold when subtotal meets or exceeds it', async () => {
        const method = await methods.create({
            carrier: 'rate_table',
            service: 'post',
            freeThreshold: 100000,
        })

        expect((await run(method.code, {subtotalAfterDiscounts: 99999})).isFree).toBe(false)
        expect((await run(method.code, {subtotalAfterDiscounts: 100000})).isFree).toBe(true)
        expect((await run(method.code, {subtotalAfterDiscounts: 100000})).fee).toBe(0)
    })

    it('rejects unknown or inactive methods', async () => {
        await expect(run('missing_method_code')).rejects.toMatchObject({
            code: 'SHIPPING_METHOD_NOT_FOUND',
            status: 404,
        })

        const inactive = await methods.create({carrier: 'rate_table', service: 'post', isActive: false})
        await expect(run(inactive.code)).rejects.toMatchObject({
            code: 'SHIPPING_METHOD_NOT_FOUND',
            status: 404,
        })
        expectError(await admin.get(`/admin/shipping-methods/${inactive.id}`), 200,'SHIPPING_METHOD_GET_SUCCESS')
    })
})
