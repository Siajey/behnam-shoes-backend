import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    UserSession,
    VariantSeed,
    changeVariant,
    createPublishedProduct,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    getCart,
    lineOf,
    putInCart,
    randomId,
    unpublishProduct,
} from './cart-test.util'

describe('Cart: PATCH /cart/items/:variantId (e2e)', () => {
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
    const setQuantity = (variantId: string, quantity: unknown) =>
        user.api.patch(`/cart/items/${variantId}`, {quantity})

    describe('updating', () => {
        it('sets the quantity (replaces it, does not add)', async () => {
            const product = await published([{price: 1000, stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)

            const res = await setQuantity(variantId, 5)

            expectOk(res, 200, 'CART_UPDATE_ITEM_SUCCESS')
            expect(lineOf(res.json().data, variantId)).toMatchObject({quantity: 5, lineTotal: 5000})
            expect(res.json().data.totals).toMatchObject({itemCount: 5, subtotal: 5000, total: 5000})
        })

        it('can lower the quantity', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 6)

            const res = await setQuantity(variantId, 1)

            expect(lineOf(res.json().data, variantId).quantity).toBe(1)
        })

        it('accepts the per-line maximum of 10', async () => {
            const product = await published([{stock: 50}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 1)

            const res = await setQuantity(variantId, 10)

            expect(lineOf(res.json().data, variantId).quantity).toBe(10)
        })

        it('coerces a numeric string', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 1)

            const res = await setQuantity(variantId, '4')

            expect(lineOf(res.json().data, variantId).quantity).toBe(4)
        })

        it('caps the quantity at the available stock', async () => {
            const product = await published([{stock: 3}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 1)

            const res = await setQuantity(variantId, 7)

            expect(res.statusCode).toBe(200)
            expect(lineOf(res.json().data, variantId).quantity).toBe(3)
        })

        it('only touches the requested line and persists the change', async () => {
            const product = await published([{size: '40', stock: 9}, {size: '41', stock: 9}])
            const [first, second] = product.variantIds
            await putInCart(user.api, first, 2)
            await putInCart(user.api, second, 3)

            await setQuantity(first, 6)

            const cart = await getCart(user.api)
            expect(lineOf(cart, first).quantity).toBe(6)
            expect(lineOf(cart, second).quantity).toBe(3)
        })

        it('lets the user fix a line whose quantity exceeds the new stock', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 4)
            await changeVariant(ctx.app, product.variants[0], {stock: 2})
            expect(lineOf(await getCart(user.api), variantId).unavailableReason).toBe('insufficientStock')

            const res = await setQuantity(variantId, 1)

            expect(res.statusCode).toBe(200)
            expect(lineOf(res.json().data, variantId)).toMatchObject({
                quantity: 1,
                available: true,
                unavailableReason: null,
            })
        })

        it('caps at the reduced stock when asking for more than is left', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 4)
            await changeVariant(ctx.app, product.variants[0], {stock: 2})

            const res = await setQuantity(variantId, 6)

            expect(lineOf(res.json().data, variantId).quantity).toBe(2)
        })
    })

    describe('missing items', () => {
        it('returns 404 when the user has no cart at all', async () => {
            const fresh = await createUserSession(ctx)
            const product = await published([{}])

            const res = await fresh.api.patch(`/cart/items/${product.variantIds[0]}`, {quantity: 1})

            expectError(res, 404, 'CART_ITEM_NOT_FOUND')
        })

        it('returns 404 when the variant is not in the cart', async () => {
            const product = await published([{size: '40'}, {size: '41'}])
            await putInCart(user.api, product.variantIds[0])

            expectError(await setQuantity(product.variantIds[1], 2), 404, 'CART_ITEM_NOT_FOUND')
            expectError(await setQuantity(randomId(), 2), 404, 'CART_ITEM_NOT_FOUND')
        })

        it('does not create the line as a side effect', async () => {
            const product = await published([{size: '40'}, {size: '41'}])
            await putInCart(user.api, product.variantIds[0])

            await setQuantity(product.variantIds[1], 2)

            expect((await getCart(user.api)).items).toHaveLength(1)
        })
    })

    describe('lines that can no longer be bought', () => {
        it('returns 409 for an out-of-stock variant and keeps the quantity', async () => {
            const product = await published([{stock: 5}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 3)
            await changeVariant(ctx.app, product.variants[0], {stock: 0})

            expectError(await setQuantity(variantId, 1), 409, 'CART_VARIANT_UNAVAILABLE')

            expect(lineOf(await getCart(user.api), variantId).quantity).toBe(3)
        })

        it('returns 409 for an inactive variant', async () => {
            const product = await published([{size: '40'}, {size: '41'}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)
            await changeVariant(ctx.app, product.variants[0], {isActive: false})

            expectError(await setQuantity(variantId, 1), 409, 'CART_VARIANT_UNAVAILABLE')
        })

        it('returns 409 when the product was unpublished', async () => {
            const product = await published([{}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)
            await unpublishProduct(admin, product.id)

            expectError(await setQuantity(variantId, 1), 409, 'CART_VARIANT_UNAVAILABLE')
        })
    })

    describe('validation', () => {
        it.each([
            ['a missing quantity', undefined],
            ['quantity 0', 0],
            ['a negative quantity', -2],
            ['quantity 11', 11],
            ['a fractional quantity', 2.5],
            ['a non-numeric quantity', 'abc'],
            ['a null quantity', null],
        ])('rejects %s', async (_label, quantity) => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)

            const body = quantity === undefined ? {} : {quantity}
            expectValidationError(await user.api.patch(`/cart/items/${product.variantIds[0]}`, body))

            expect(lineOf(await getCart(user.api), product.variantIds[0]).quantity).toBe(2)
        })

        it('rejects a malformed variantId', async () => {
            expectValidationError(await user.api.patch('/cart/items/not-a-uuid', {quantity: 1}))
        })
    })
})
