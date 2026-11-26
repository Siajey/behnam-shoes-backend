import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, expectError, randomId} from '../../util/test.util'
import {methodTracker} from './shipping-test.util'

describe('Shipping: admin methods (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let methods: ReturnType<typeof methodTracker>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        methods = methodTracker(admin)
    })

    afterEach(async () => {
        await methods.cleanup()
    })

    it('creates, lists, gets, updates, and deletes a shipping method', async () => {
        const created = await methods.create({
            code: 'standard_post',
            name: 'Standard Post',
            description: '3 to 7 business days',
            carrier: 'rate_table',
            service: 'post',
            position: 2,
            fallbackFee: 100000,
            freeThreshold: 500000,
            handlingFee: 5000,
        })

        expect(created).toMatchObject({
            code: 'standard_post',
            name: 'Standard Post',
            description: '3 to 7 business days',
            carrier: 'rate_table',
            service: 'post',
            isActive: true,
            position: 2,
            fallbackFee: 100000,
            freeThreshold: 500000,
            handlingFee: 5000,
        })

        const getRes = await admin.get(`/admin/shipping-methods/${created.id}`)
        expect(getRes.statusCode).toBe(200)
        expect(getRes.json().data.id).toBe(created.id)

        const listRes = await admin.get('/admin/shipping-methods')
        expect(listRes.statusCode).toBe(200)
        expect(listRes.json().data.some((m: {id: string}) => m.id === created.id)).toBe(true)

        const patchRes = await admin.patch(`/admin/shipping-methods/${created.id}`, {
            name: 'Updated Post',
            isActive: false,
            handlingFee: 0,
        })
        expect(patchRes.statusCode).toBe(200)
        expect(patchRes.json().data).toMatchObject({
            name: 'Updated Post',
            isActive: false,
            handlingFee: 0,
        })

        const delRes = await admin.delete(`/admin/shipping-methods/${created.id}`)
        expect(delRes.statusCode).toBe(200)
        expectError(await admin.get(`/admin/shipping-methods/${created.id}`), 404, 'SHIPPING_METHOD_NOT_FOUND')
    })

    it('rejects duplicate method codes and unknown carriers', async () => {
        const first = await methods.create({code: 'dup_code'})
        expect(first.code).toBe('dup_code')

        expectError(
            await admin.post('/admin/shipping-methods', {
                code: 'dup_code',
                name: 'Duplicate',
                carrier: 'rate_table',
                service: 'post',
            }),
            409,
            'SHIPPING_METHOD_CODE_ALREADY_EXISTS',
        )

        expectError(
            await admin.post('/admin/shipping-methods', {
                code: 'bad_carrier',
                name: 'Bad Carrier',
                carrier: 'nonexistent_carrier',
                service: 'post',
            }),
            400,
            'SHIPPING_CARRIER_NOT_SUPPORTED',
        )
    })

    it('returns 404 for unknown method ids', async () => {
        const missingId = randomId()
        expectError(await admin.get(`/admin/shipping-methods/${missingId}`), 404, 'SHIPPING_METHOD_NOT_FOUND')
        expectError(
            await admin.patch(`/admin/shipping-methods/${missingId}`, {name: 'Nope'}),
            404,
            'SHIPPING_METHOD_NOT_FOUND',
        )
        expectError(await admin.delete(`/admin/shipping-methods/${missingId}`), 404, 'SHIPPING_METHOD_NOT_FOUND')
    })
})
