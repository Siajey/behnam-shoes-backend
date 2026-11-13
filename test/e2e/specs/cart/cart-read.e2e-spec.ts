import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    expectOk,
    sleep,
    UserSession,
} from '../../../util/test.util'
import {
    createPublishedProduct,
    imageKeyOf,
} from '../product/product-test.util'
import {
    EMPTY_CART,
    getCart,
    putInCart,
    variantIdsInCart,
} from './cart-test.util'

describe('Cart: GET /cart (e2e)', () => {
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

    it('returns an empty cart for a user that never added anything', async () => {
        const fresh = await createUserSession(ctx)

        const res = await fresh.api.get('/cart')

        expectOk(res, 200, 'CART_GET_SUCCESS')
        expect(res.json().data).toEqual(EMPTY_CART)
    })

    it('does not change anything when reading (repeated reads are identical)', async () => {
        const product = await createPublishedProduct(ctx.app, admin, {variants: [{price: 1000, stock: 5}]})
        await putInCart(user.api, product.variantIds[0], 2)

        const first = await getCart(user.api)
        const second = await getCart(user.api)

        expect(second).toEqual(first)
    })

    it('returns the full line shape, prices and totals', async () => {
        const product = await createPublishedProduct(ctx.app, admin, {
            variants: [
                {size: '40', color: 'black', price: 1000, stock: 5},
                {size: '41', color: 'white', price: 2500, stock: 20},
            ],
        })
        const [small, large] = product.variantIds
        await putInCart(user.api, small, 2)
        await putInCart(user.api, large, 1)

        const res = await user.api.get('/cart')

        expectOk(res, 200, 'CART_GET_SUCCESS')
        const productBlock = {
            id: product.id,
            name: product.name,
            slug: product.slug,
            imageKey: imageKeyOf(product.id),
        }
        expect(res.json().data).toEqual({
            items: [
                {
                    variantId: small,
                    quantity: 2,
                    available: true,
                    unavailableReason: null,
                    maxQuantity: 5,
                    product: productBlock,
                    attributes: expect.arrayContaining([
                        {name: 'size', value: '40'},
                        {name: 'color', value: 'black'},
                    ]),
                    originalUnitPrice: 1000,
                    unitPrice: 1000,
                    lineTotal: 2000,
                    couponAllocation: 0,
                },
                {
                    variantId: large,
                    quantity: 1,
                    available: true,
                    unavailableReason: null,
                    maxQuantity: 10, // capped at the per-line maximum even though 20 are in stock
                    product: productBlock,
                    attributes: expect.arrayContaining([
                        {name: 'size', value: '41'},
                        {name: 'color', value: 'white'},
                    ]),
                    originalUnitPrice: 2500,
                    unitPrice: 2500,
                    lineTotal: 2500,
                    couponAllocation: 0,
                },
            ],
            coupon: {code: null, status: 'none'},
            totals: {itemCount: 3, subtotal: 4500, productDiscountTotal: 0, couponDiscount: 0, total: 4500},
            hasUnavailableLines: false,
        })
    })

    it('keeps lines in the order they were first added', async () => {
        const product = await createPublishedProduct(ctx.app, admin, {
            variants: [{size: '40'}, {size: '41'}, {size: '42'}],
        })
        const [a, b, c] = product.variantIds
        for (const id of [a, b, c]) {
            await putInCart(user.api, id)
            await sleep(10)
        }

        // adding to an existing line does not move it
        await putInCart(user.api, a)
        expect(variantIdsInCart(await getCart(user.api))).toEqual([a, b, c])

        // removing and re-adding moves the line to the end
        expect((await user.api.delete(`/cart/items/${b}`)).statusCode).toBe(200)
        await sleep(10)
        await putInCart(user.api, b)
        expect(variantIdsInCart(await getCart(user.api))).toEqual([a, c, b])
    })

    it('returns the same data from GET as from the mutation that produced it', async () => {
        const product = await createPublishedProduct(ctx.app, admin, {variants: [{price: 700, stock: 9}]})

        const afterAdd = await putInCart(user.api, product.variantIds[0], 3)

        expect(await getCart(user.api)).toEqual(afterAdd)
    })

    it('keeps carts of different users separate', async () => {
        const other = await createUserSession(ctx)
        const product = await createPublishedProduct(ctx.app, admin, {variants: [{stock: 9}]})
        const variantId = product.variantIds[0]

        await putInCart(user.api, variantId, 2)
        await putInCart(other.api, variantId, 5)

        expect((await getCart(user.api)).items[0].quantity).toBe(2)
        expect((await getCart(other.api)).items[0].quantity).toBe(5)

        await other.api.delete('/cart')
        expect((await getCart(user.api)).items).toHaveLength(1)
    })
})
