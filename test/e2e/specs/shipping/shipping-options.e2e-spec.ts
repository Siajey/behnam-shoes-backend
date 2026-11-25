import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createUserSession, expectError} from '../../util/test.util'
import {createPublishedProduct} from '../product/product-test.util'
import {Customer, createCustomer, fillCart} from '../order/order-test.util'
import {GILAN, ISFAHAN, addAddress, methodTracker} from './shipping-test.util'

describe('Shipping: public options endpoint (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let customer: Customer
    let addressId: string
    let methods: ReturnType<typeof methodTracker>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        methods = methodTracker(admin)

        const product = await createPublishedProduct(ctx.app, admin, {
            variants: [{price: 50000, stock: 100}],
        })
        customer = await createCustomer(ctx, {withAddress: false})
        addressId = await addAddress(customer, ISFAHAN)
        await customer.api.delete('/cart')
        await fillCart(customer.api, [{variantId: product.variantIds[0], quantity: 1}])
    })

    afterEach(async () => {
        await methods.cleanup()
    })

    it('returns active shipping options with computed fees', async () => {
        const post = await methods.create({
            name: 'Post',
            carrier: 'rate_table',
            service: 'post',
            position: 0,
            isActive: true,
        })
        const hidden = await methods.create({
            name: 'Hidden',
            carrier: 'rate_table',
            service: 'express',
            position: 1,
            isActive: false,
        })

        const res = await customer.api.get(`/shipping/options?addressId=${addressId}`)
        expect(res.statusCode).toBe(200)

        const options = res.json().data.options as Array<{methodCode: string; available: boolean; fee?: number}>
        expect(options.some((o) => o.methodCode === post.code && o.available && o.fee === 115000)).toBe(true)
        expect(options.some((o) => o.methodCode === hidden.code)).toBe(false)
    })

    it('rejects invalid addressId query', async () => {
        expectError(await customer.api.get('/shipping/options?addressId=not-a-uuid'), 400,'VALIDATION_ERROR')
    })

    it('supports same-province origin address', async () => {
        const gilanAddressId = await addAddress(customer, GILAN)
        const post = await methods.create({carrier: 'rate_table', service: 'post'})

        const res = await customer.api.get(`/shipping/options?addressId=${gilanAddressId}`)
        expect(res.statusCode).toBe(200)
        const options = res.json().data.options as Array<{methodCode: string; available: boolean; fee?: number}>
        expect(options.some((o) => o.methodCode === post.code && o.available && o.fee === 85000)).toBe(true)
    })
})
