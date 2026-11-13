import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    EMPTY_CART,
    UserSession,
    VariantSeed,
    archiveProduct,
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
    variantIdsInCart,
} from './cart-test.util'

describe('Cart: remove item and clear (e2e)', () => {
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

    describe('DELETE /cart/items/:variantId', () => {
        it('removes one line, keeps the others and recalculates totals', async () => {
            const product = await published([
                {size: '40', price: 1000, stock: 9},
                {size: '41', price: 2000, stock: 9},
            ])
            const [first, second] = product.variantIds
            await putInCart(user.api, first, 2)
            await putInCart(user.api, second, 1)

            const res = await user.api.delete(`/cart/items/${first}`)

            expectOk(res, 200, 'CART_REMOVE_ITEM_SUCCESS')
            expect(variantIdsInCart(res.json().data)).toEqual([second])
            expect(res.json().data.totals).toMatchObject({itemCount: 1, subtotal: 2000, total: 2000})
            expect(variantIdsInCart(await getCart(user.api))).toEqual([second])
        })

        it('returns an empty cart after removing the last line', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 3)

            const res = await user.api.delete(`/cart/items/${product.variantIds[0]}`)

            expect(res.statusCode).toBe(200)
            expect(res.json().data).toEqual(EMPTY_CART)
        })

        it('removes the whole line regardless of its quantity', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 7)

            const res = await user.api.delete(`/cart/items/${product.variantIds[0]}`)

            expect(res.json().data.items).toEqual([])
        })

        it('can remove lines that are no longer available', async () => {
            const product = await published([{size: '40', stock: 5}, {size: '41', stock: 5}])
            const [inactive, soldOut] = product.variantIds
            await putInCart(user.api, inactive, 1)
            await putInCart(user.api, soldOut, 1)
            await changeVariant(ctx.app, product.variants[0], {isActive: false})
            await changeVariant(ctx.app, product.variants[1], {stock: 0})
            expect((await getCart(user.api)).hasUnavailableLines).toBe(true)

            expect((await user.api.delete(`/cart/items/${inactive}`)).statusCode).toBe(200)
            const res = await user.api.delete(`/cart/items/${soldOut}`)

            expect(res.statusCode).toBe(200)
            expect(res.json().data).toEqual(EMPTY_CART)
        })

        it('can remove a line whose product was unpublished or archived', async () => {
            const unpublished = await published([{}])
            const archived = await published([{}])
            await putInCart(user.api, unpublished.variantIds[0])
            await putInCart(user.api, archived.variantIds[0])
            await unpublishProduct(admin, unpublished.id)
            await archiveProduct(admin, archived.id)

            expect((await user.api.delete(`/cart/items/${unpublished.variantIds[0]}`)).statusCode).toBe(200)
            const res = await user.api.delete(`/cart/items/${archived.variantIds[0]}`)

            expect(res.json().data.items).toEqual([])
        })

        it('returns 404 when the variant is not in the cart, also on a second removal', async () => {
            const product = await published([{size: '40'}, {size: '41'}])
            const [inCart, other] = product.variantIds
            await putInCart(user.api, inCart)

            expectError(await user.api.delete(`/cart/items/${other}`), 404, 'CART_ITEM_NOT_FOUND')
            expectError(await user.api.delete(`/cart/items/${randomId()}`), 404, 'CART_ITEM_NOT_FOUND')

            expect((await user.api.delete(`/cart/items/${inCart}`)).statusCode).toBe(200)
            expectError(await user.api.delete(`/cart/items/${inCart}`), 404, 'CART_ITEM_NOT_FOUND')
        })

        it('returns 404 when the user has no cart yet', async () => {
            const fresh = await createUserSession(ctx)

            expectError(await fresh.api.delete(`/cart/items/${randomId()}`), 404, 'CART_ITEM_NOT_FOUND')
        })

        it('returns 400 for a malformed variantId', async () => {
            expectValidationError(await user.api.delete('/cart/items/not-a-uuid'))
        })

        it('allows adding the variant again afterwards', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 4)
            await user.api.delete(`/cart/items/${variantId}`)

            const data = await putInCart(user.api, variantId, 1)

            expect(lineOf(data, variantId).quantity).toBe(1)
        })
    })

    describe('DELETE /cart', () => {
        it('removes every line and returns the empty cart', async () => {
            const product = await published([{size: '40', stock: 9}, {size: '41', stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await putInCart(user.api, product.variantIds[1], 3)

            const res = await user.api.delete('/cart')

            expectOk(res, 200, 'CART_CLEAR_SUCCESS')
            expect(res.json().data).toEqual(EMPTY_CART)
            expect(await getCart(user.api)).toEqual(EMPTY_CART)
        })

        it('succeeds for a user that has no cart and when called repeatedly', async () => {
            const fresh = await createUserSession(ctx)

            for (let i = 0; i < 2; i++) {
                const res = await fresh.api.delete('/cart')
                expectOk(res, 200, 'CART_CLEAR_SUCCESS')
                expect(res.json().data).toEqual(EMPTY_CART)
            }
        })

        it('clears lines that are unavailable too', async () => {
            const product = await published([{size: '40', stock: 5}, {size: '41', stock: 5}])
            await putInCart(user.api, product.variantIds[0])
            await putInCart(user.api, product.variantIds[1])
            await changeVariant(ctx.app, product.variants[0], {isActive: false})
            await unpublishProduct(admin, product.id)

            const res = await user.api.delete('/cart')

            expect(res.json().data).toEqual(EMPTY_CART)
        })

        it('does not touch the carts of other users', async () => {
            const other = await createUserSession(ctx)
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await putInCart(other.api, product.variantIds[0], 4)

            await user.api.delete('/cart')

            expect(await getCart(user.api)).toEqual(EMPTY_CART)
            expect(lineOf(await getCart(other.api), product.variantIds[0]).quantity).toBe(4)
        })

        it('leaves a cart that can be used again', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await user.api.delete('/cart')

            const data = await putInCart(user.api, product.variantIds[0], 1)

            expect(data.items).toHaveLength(1)
            expect(data.items[0].quantity).toBe(1)
        })
    })
})
