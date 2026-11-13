import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    UserSession,
} from '../../../util/test.util'
import {
    archiveProduct,
    createDraftProduct,
    createPublishedProduct,
    seedVariants,
    unpublishProduct,
    VariantSeed,
} from '../product/product-test.util'
import {
    addToCart,
    getCart,
    lineOf,
    putInCart,
} from './cart-test.util'

describe('Cart: POST /cart/items (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
    })

    beforeEach(async () => {
        await user.api.delete('/cart')
    })

    const published = (variants: VariantSeed[]) => createPublishedProduct(ctx.app, admin, {variants})

    describe('adding', () => {
        it('adds a variant with the default quantity of 1', async () => {
            const product = await published([{price: 1500, stock: 5}])
            const variantId = product.variantIds[0]

            const res = await addToCart(user.api, variantId)

            expectOk(res, 200, 'CART_ADD_ITEM_SUCCESS')
            const data = res.json().data
            expect(data.items).toHaveLength(1)
            expect(data.items[0]).toMatchObject({
                variantId,
                quantity: 1,
                available: true,
                unitPrice: 1500,
                lineTotal: 1500,
            })
            expect(data.totals).toMatchObject({itemCount: 1, subtotal: 1500, total: 1500})
        })

        it('adds an explicit quantity', async () => {
            const product = await published([{price: 1000, stock: 9}])

            const data = await putInCart(user.api, product.variantIds[0], 4)

            expect(data.items[0]).toMatchObject({quantity: 4, lineTotal: 4000})
            expect(data.totals.itemCount).toBe(4)
        })

        it('coerces a numeric string quantity', async () => {
            const product = await published([{stock: 9}])

            const res = await user.api.post('/cart/items', {variantId: product.variantIds[0], quantity: '3'})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.items[0].quantity).toBe(3)
        })

        it('adds to an existing line instead of creating a second one', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]

            await putInCart(user.api, variantId, 2)
            const data = await putInCart(user.api, variantId, 3)

            expect(data.items).toHaveLength(1)
            expect(data.items[0].quantity).toBe(5)
        })

        it('persists the cart between requests', async () => {
            const product = await published([{size: '40'}, {size: '41'}])

            await putInCart(user.api, product.variantIds[0], 2)
            await putInCart(user.api, product.variantIds[1], 1)

            const cart = await getCart(user.api)
            expect(cart.items.map((i: any) => [i.variantId, i.quantity])).toEqual([
                [product.variantIds[0], 2],
                [product.variantIds[1], 1],
            ])
        })

        it('ignores unknown body fields', async () => {
            const product = await published([{stock: 9}])

            const res = await user.api.post('/cart/items', {
                variantId: product.variantIds[0],
                quantity: 1,
                price: 1,
                couponCode: 'FREE',
            })

            expect(res.statusCode).toBe(200)
            expect(res.json().data.coupon).toEqual({code: null, status: 'none'})
            expect(res.json().data.items[0].unitPrice).not.toBe(1)
        })
    })

    describe('stock handling', () => {
        it('caps the quantity at the available stock instead of failing', async () => {
            const product = await published([{stock: 3}])

            const data = await putInCart(user.api, product.variantIds[0], 5)

            expect(data.items[0].quantity).toBe(3)
        })

        it('caps accumulated quantities at the available stock', async () => {
            const product = await published([{stock: 4}])
            const variantId = product.variantIds[0]

            await putInCart(user.api, variantId, 3)
            const data = await putInCart(user.api, variantId, 3)

            expect(data.items[0].quantity).toBe(4)
        })

        it('succeeds without changes when the cart already holds all the stock', async () => {
            const product = await published([{stock: 3}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 3)

            const res = await addToCart(user.api, variantId, 1)

            expect(res.statusCode).toBe(200)
            expect(lineOf(res.json().data, variantId).quantity).toBe(3)
        })
    })

    describe('limits', () => {
        it('accepts a line of exactly 10 and rejects going above it', async () => {
            const product = await published([{stock: 50}])
            const variantId = product.variantIds[0]

            const ten = await putInCart(user.api, variantId, 10)
            expect(ten.items[0].quantity).toBe(10)

            expectError(await addToCart(user.api, variantId, 1), 400, 'CART_QUANTITY_LIMIT_EXCEEDED')
            expect(lineOf(await getCart(user.api), variantId).quantity).toBe(10)
        })

        it('rejects an addition that would push an existing line over 10 and keeps the old quantity', async () => {
            const product = await published([{stock: 50}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 6)

            expectError(await addToCart(user.api, variantId, 6), 400, 'CART_QUANTITY_LIMIT_EXCEEDED')

            expect(lineOf(await getCart(user.api), variantId).quantity).toBe(6)
        })
    })

    describe('variants that cannot be bought', () => {
        const unavailable: [string, () => Promise<string>][] = [
            ['an unknown variant', async () => randomId()],
            ['a variant without a product', async () => (await seedVariants(ctx.app, [{}])).variants[0].id],
            [
                'an inactive variant',
                async () => (await published([{size: '40'}, {size: '41', isActive: false}])).variantIds[1],
            ],
            ['an out-of-stock variant', async () => (await published([{stock: 0}])).variantIds[0]],
            [
                'a variant of a draft product',
                async () => (await createDraftProduct(ctx.app, admin, [{}])).variants[0].id,
            ],
            [
                'a variant of an unpublished product',
                async () => {
                    const product = await published([{}])
                    await unpublishProduct(admin, product.id)
                    return product.variantIds[0]
                },
            ],
            [
                'a variant of an archived product',
                async () => {
                    const product = await published([{}])
                    await archiveProduct(admin, product.id)
                    return product.variantIds[0]
                },
            ],
        ]

        it.each(unavailable)('rejects %s with 409 and leaves the cart empty', async (_label, arrange) => {
            const variantId = await arrange()

            expectError(await addToCart(user.api, variantId), 409, 'CART_VARIANT_UNAVAILABLE')

            expect((await getCart(user.api)).items).toEqual([])
        })
    })

    describe('validation', () => {
        const valid = () => ({variantId: randomId(), quantity: 1})

        const invalidBodies: [string, () => Record<string, unknown>][] = [
            ['a missing variantId', () => ({quantity: 1})],
            ['a malformed variantId', () => ({...valid(), variantId: 'not-a-uuid'})],
            ['a numeric variantId', () => ({...valid(), variantId: 12})],
            ['quantity 0', () => ({...valid(), quantity: 0})],
            ['a negative quantity', () => ({...valid(), quantity: -1})],
            ['quantity 11', () => ({...valid(), quantity: 11})],
            ['a fractional quantity', () => ({...valid(), quantity: 1.5})],
            ['a non-numeric quantity', () => ({...valid(), quantity: 'abc'})],
            ['a null quantity', () => ({...valid(), quantity: null})],
        ]

        it.each(invalidBodies)('rejects %s', async (_label, build) => {
            expectValidationError(await user.api.post('/cart/items', build()))
        })

        it('rejects an empty body', async () => {
            expectValidationError(await user.api.post('/cart/items', {}))
        })
    })
})
