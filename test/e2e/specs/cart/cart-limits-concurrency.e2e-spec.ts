import {beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    expectError,
    expectValidationError,
    UserSession,
} from '../../../util/test.util'
import {
    createPublishedProduct,
    VariantSeed,
} from '../product/product-test.util'
import {
    addToCart,
    getCart,
    lineOf,
    mergeCart,
    putInCart,
    variantIdsInCart,
} from './cart-test.util'

const MAX_LINES = 50

describe('Cart: line limit and concurrency (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let bigVariantIds: string[]

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api

        // One product with 51 variants (sizes 16, 16.5, ... 41) so a single cart can hit the 50-line limit.
        const seeds: VariantSeed[] = Array.from({length: MAX_LINES + 1}, (_, i) => ({
            size: String(16 + i * 0.5),
            color: 'black',
            price: 100,
            stock: 5,
        }))
        const big = await createPublishedProduct(ctx.app, admin, {variants: seeds})
        bigVariantIds = big.variantIds
    })

    const fullCart = async () => {
        const user = await createUserSession(ctx)
        const res = await mergeCart(
            user.api,
            bigVariantIds.slice(0, MAX_LINES).map((variantId) => ({variantId, quantity: 1})),
        )
        expect(res.statusCode).toBe(200)
        expect(res.json().data.skippedVariantIds).toEqual([])
        expect(res.json().data.cart.items).toHaveLength(MAX_LINES)
        return user
    }

    describe('50 distinct lines', () => {
        it('rejects a 51st distinct line when adding and keeps the cart as it was', async () => {
            const user = await fullCart()

            const res = await addToCart(user.api, bigVariantIds[MAX_LINES])

            expectError(res, 400, 'CART_LINE_LIMIT_REACHED')
            expect((await getCart(user.api)).items).toHaveLength(MAX_LINES)
        })

        it('still allows increasing an existing line when the cart is full', async () => {
            const user = await fullCart()

            const data = await putInCart(user.api, bigVariantIds[0], 2)

            expect(data.items).toHaveLength(MAX_LINES)
            expect(lineOf(data, bigVariantIds[0]).quantity).toBe(3)
        })

        it('allows a new line again after one was removed', async () => {
            const user = await fullCart()
            expect((await user.api.delete(`/cart/items/${bigVariantIds[0]}`)).statusCode).toBe(200)

            const data = await putInCart(user.api, bigVariantIds[MAX_LINES])

            expect(data.items).toHaveLength(MAX_LINES)
            expect(variantIdsInCart(data)).toContain(bigVariantIds[MAX_LINES])
        })

        it('skips new lines in a merge when the cart is full but merges quantities of existing ones', async () => {
            const user = await fullCart()

            const res = await mergeCart(user.api, [
                {variantId: bigVariantIds[MAX_LINES], quantity: 1},
                {variantId: bigVariantIds[1], quantity: 2},
            ])

            expect(res.statusCode).toBe(200)
            const {cart, skippedVariantIds} = res.json().data
            expect(skippedVariantIds).toEqual([bigVariantIds[MAX_LINES]])
            expect(cart.items).toHaveLength(MAX_LINES)
            expect(lineOf(cart, bigVariantIds[1]).quantity).toBe(3)
        })

        it('rejects merge payloads with more than 50 items before touching the cart', async () => {
            const user = await createUserSession(ctx)

            const res = await user.api.post('/cart/merge', {
                items: bigVariantIds.map((variantId) => ({variantId, quantity: 1})),
            })

            expectValidationError(res)
            expect((await getCart(user.api)).items).toEqual([])
        })
    })

    describe('concurrent requests', () => {
        it('keeps both items when two adds race on a brand-new cart', async () => {
            const user: UserSession = await createUserSession(ctx)

            const [first, second] = await Promise.all([
                addToCart(user.api, bigVariantIds[0]),
                addToCart(user.api, bigVariantIds[1]),
            ])

            expect([first.statusCode, second.statusCode]).toEqual([200, 200])
            expect((await getCart(user.api)).items.map((i: any) => i.variantId).sort()).toEqual(
                [bigVariantIds[0], bigVariantIds[1]].sort(),
            )
        })

        it('keeps both items when two adds race on an existing cart', async () => {
            const user = await createUserSession(ctx)
            await putInCart(user.api, bigVariantIds[0])

            const [first, second] = await Promise.all([
                addToCart(user.api, bigVariantIds[1]),
                addToCart(user.api, bigVariantIds[2]),
            ])

            expect([first.statusCode, second.statusCode]).toEqual([200, 200])
            expect(await getCart(user.api).then((c) => c.items)).toHaveLength(3)
        })

        it('accumulates two parallel increments of the same line', async () => {
            const user = await createUserSession(ctx)
            await putInCart(user.api, bigVariantIds[0], 1)

            const [first, second] = await Promise.all([
                addToCart(user.api, bigVariantIds[0], 1),
                addToCart(user.api, bigVariantIds[0], 1),
            ])

            expect([first.statusCode, second.statusCode]).toEqual([200, 200])
            expect(lineOf(await getCart(user.api), bigVariantIds[0]).quantity).toBe(3)
        })

        it('keeps the result consistent when an add races with a quantity change on another line', async () => {
            const user = await createUserSession(ctx)
            await putInCart(user.api, bigVariantIds[0], 1)

            const [added, updated] = await Promise.all([
                addToCart(user.api, bigVariantIds[1], 2),
                user.api.patch(`/cart/items/${bigVariantIds[0]}`, {quantity: 4}),
            ])

            expect([added.statusCode, updated.statusCode]).toEqual([200, 200])
            const cart = await getCart(user.api)
            expect(lineOf(cart, bigVariantIds[0]).quantity).toBe(4)
            expect(lineOf(cart, bigVariantIds[1]).quantity).toBe(2)
        })
    })
})
