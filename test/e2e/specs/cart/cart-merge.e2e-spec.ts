import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    EMPTY_CART,
    UserSession,
    VariantSeed,
    archiveProduct,
    createDraftProduct,
    createPublishedProduct,
    createUserSession,
    expectOk,
    expectValidationError,
    getCart,
    lineOf,
    mergeCart,
    putInCart,
    randomId,
    seedVariants,
    unpublishProduct,
    variantIdsInCart,
} from './cart-test.util'

describe('Cart: POST /cart/merge (e2e)', () => {
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

    const merge = async (items: { variantId: string; quantity: number }[]) => {
        const res = await mergeCart(user.api, items)
        expectOk(res, 200, 'CART_MERGE_SUCCESS')
        return res.json().data as { cart: any; skippedVariantIds: string[] }
    }

    describe('merging a guest cart', () => {
        it('creates the cart from the guest items', async () => {
            const product = await published([
                {size: '40', price: 1000, stock: 9},
                {size: '41', price: 2000, stock: 9},
            ])
            const [first, second] = product.variantIds

            const {cart, skippedVariantIds} = await merge([
                {variantId: first, quantity: 2},
                {variantId: second, quantity: 1},
            ])

            expect(skippedVariantIds).toEqual([])
            expect(cart.items.map((i: any) => [i.variantId, i.quantity])).toEqual([
                [first, 2],
                [second, 1],
            ])
            expect(cart.totals).toMatchObject({itemCount: 3, subtotal: 4000, total: 4000})
            expect(await getCart(user.api)).toEqual(cart)
        })

        it('adds guest quantities on top of what the account cart already holds', async () => {
            const product = await published([{size: '40', stock: 9}, {size: '41', stock: 9}])
            const [first, second] = product.variantIds
            await putInCart(user.api, first, 2)

            const {cart} = await merge([
                {variantId: first, quantity: 3},
                {variantId: second, quantity: 4},
            ])

            expect(lineOf(cart, first).quantity).toBe(5)
            expect(lineOf(cart, second).quantity).toBe(4)
        })

        it('sums duplicate variants inside the request', async () => {
            const product = await published([{stock: 20}])
            const variantId = product.variantIds[0]

            const {cart, skippedVariantIds} = await merge([
                {variantId, quantity: 3},
                {variantId, quantity: 4},
            ])

            expect(cart.items).toHaveLength(1)
            expect(lineOf(cart, variantId).quantity).toBe(7)
            expect(skippedVariantIds).toEqual([])
        })

        it('caps summed duplicates at 10 per line without skipping them', async () => {
            const product = await published([{stock: 20}])
            const variantId = product.variantIds[0]

            const {cart, skippedVariantIds} = await merge([
                {variantId, quantity: 8},
                {variantId, quantity: 8},
            ])

            expect(lineOf(cart, variantId).quantity).toBe(10)
            expect(skippedVariantIds).toEqual([])
        })

        it('caps the line at 10 when the account cart already holds some', async () => {
            const product = await published([{stock: 50}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 7)

            const {cart} = await merge([{variantId, quantity: 6}])

            expect(lineOf(cart, variantId).quantity).toBe(10)
        })

        it('skips a variant whose line is already at the 10 limit', async () => {
            const product = await published([{stock: 50}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 10)

            const {cart, skippedVariantIds} = await merge([{variantId, quantity: 1}])

            expect(skippedVariantIds).toEqual([variantId])
            expect(lineOf(cart, variantId).quantity).toBe(10)
        })
    })

    describe('stock handling', () => {
        it('caps the quantity at the available stock', async () => {
            const product = await published([{stock: 3}])
            const variantId = product.variantIds[0]

            const {cart, skippedVariantIds} = await merge([{variantId, quantity: 5}])

            expect(lineOf(cart, variantId).quantity).toBe(3)
            expect(skippedVariantIds).toEqual([])
        })

        it('counts what is already in the cart against the stock', async () => {
            const product = await published([{stock: 5}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 3)

            const {cart} = await merge([{variantId, quantity: 4}])

            expect(lineOf(cart, variantId).quantity).toBe(5)
        })

        it('ignores (without skipping) a variant when the cart already holds all of its stock', async () => {
            const product = await published([{stock: 2}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)

            const {cart, skippedVariantIds} = await merge([{variantId, quantity: 1}])

            expect(lineOf(cart, variantId).quantity).toBe(2)
            expect(skippedVariantIds).toEqual([])
        })
    })

    describe('variants that cannot be bought', () => {
        it('skips them, reports them in request order and still merges the rest', async () => {
            const good = await published([{size: '40', stock: 9}])
            const inactiveProduct = await published([{size: '40'}, {size: '41', isActive: false}])
            const soldOut = await published([{stock: 0}])
            const hidden = await published([{}])
            await unpublishProduct(admin, hidden.id)

            const unknown = randomId()
            const inactive = inactiveProduct.variantIds[1]
            const outOfStock = soldOut.variantIds[0]
            const unpublished = hidden.variantIds[0]

            const {cart, skippedVariantIds} = await merge([
                {variantId: unknown, quantity: 1},
                {variantId: good.variantIds[0], quantity: 2},
                {variantId: inactive, quantity: 1},
                {variantId: outOfStock, quantity: 1},
                {variantId: unpublished, quantity: 1},
            ])

            expect(skippedVariantIds).toEqual([unknown, inactive, outOfStock, unpublished])
            expect(variantIdsInCart(cart)).toEqual([good.variantIds[0]])
        })

        it('skips variants without a product, of draft products and of archived products', async () => {
            const orphan = (await seedVariants(ctx.app, [{}])).variants[0].id
            const draft = (await createDraftProduct(ctx.app, admin, [{}])).variants[0].id
            const archivedProduct = await published([{}])
            await archiveProduct(admin, archivedProduct.id)

            const {cart, skippedVariantIds} = await merge([
                {variantId: orphan, quantity: 1},
                {variantId: draft, quantity: 1},
                {variantId: archivedProduct.variantIds[0], quantity: 1},
            ])

            expect(skippedVariantIds).toEqual([orphan, draft, archivedProduct.variantIds[0]])
            expect(cart).toEqual(EMPTY_CART)
        })

        it('does not create a cart when every item is skipped', async () => {
            const result = await merge([{variantId: randomId(), quantity: 1}])

            expect(result.cart).toEqual(EMPTY_CART)
            expect(await getCart(user.api)).toEqual(EMPTY_CART)
        })

        it('leaves existing lines untouched when the request only contains skipped items', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)

            const {cart, skippedVariantIds} = await merge([{variantId: randomId(), quantity: 3}])

            expect(skippedVariantIds).toHaveLength(1)
            expect(lineOf(cart, product.variantIds[0]).quantity).toBe(2)
        })
    })

    describe('validation', () => {
        const item = () => ({variantId: randomId(), quantity: 1})

        const invalidBodies: [string, () => unknown][] = [
            ['a missing items field', () => ({})],
            ['items that is not an array', () => ({items: 'abc'})],
            ['an empty items array', () => ({items: []})],
            ['more than 50 items', () => ({items: Array.from({length: 51}, item)})],
            ['an item without variantId', () => ({items: [{quantity: 1}]})],
            ['an item with a malformed variantId', () => ({items: [{variantId: 'nope', quantity: 1}]})],
            ['an item without quantity', () => ({items: [{variantId: randomId()}]})],
            ['an item with quantity 0', () => ({items: [{variantId: randomId(), quantity: 0}]})],
            ['an item with quantity 11', () => ({items: [{variantId: randomId(), quantity: 11}]})],
            ['an item with a fractional quantity', () => ({items: [{variantId: randomId(), quantity: 1.5}]})],
            ['an item with a non-numeric quantity', () => ({items: [{variantId: randomId(), quantity: 'abc'}]})],
        ]

        it.each(invalidBodies)('rejects %s', async (_label, build) => {
            expectValidationError(await user.api.post('/cart/merge', build()))
        })

        it('accepts exactly 50 items', async () => {
            const res = await user.api.post('/cart/merge', {items: Array.from({length: 50}, item)})

            expect(res.statusCode).toBe(200)
            expect(res.json().data.skippedVariantIds).toHaveLength(50)
        })
    })
})
