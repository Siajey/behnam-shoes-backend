import {beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    createUserSession,
    UserSession,
} from '../../../util/test.util'
import {
    archiveProduct,
    changeVariant,
    createPublishedProduct,
    imageKeyOf,
    unpublishProduct,
    VariantSeed,
} from '../product/product-test.util'
import {
    cartSystemUseCases,
    EMPTY_CART,
    getCart,
    lineOf,
    putInCart,
    variantIdsInCart,
} from './cart-test.util'


describe('Cart: system use cases for checkout (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession
    let getCheckoutCart: ReturnType<typeof cartSystemUseCases>['getCheckoutCart']
    let clearCartAfterOrder: ReturnType<typeof cartSystemUseCases>['clearCartAfterOrder']

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
        ;({getCheckoutCart, clearCartAfterOrder} = cartSystemUseCases(ctx.app))
    })

    beforeEach(async () => {
        await user.api.delete('/cart')
    })

    const published = (variants: VariantSeed[]) => createPublishedProduct(ctx.app, admin, {variants})

    const blocked = (problems: { variantId: string | null; reason: string }[]) => ({
        code: 'CART_CHECKOUT_BLOCKED',
        status: 409,
        details: {problems},
    })

    describe('GetCheckoutCart', () => {
        it('returns priced lines, product snapshot data and totals', async () => {
            const product = await published([
                {size: '40', color: 'black', price: 1000, stock: 9},
                {size: '41', color: 'white', price: 2500, stock: 9},
            ])
            const [first, second] = product.variantIds
            await putInCart(user.api, first, 2)
            await putInCart(user.api, second, 1)

            const checkout = await getCheckoutCart.execute(user.userId)

            expect(checkout).toEqual({
                lines: [
                    {
                        variantId: first,
                        productId: product.id,
                        productName: product.name,
                        productSlug: product.slug,
                        imageKey: imageKeyOf(product.id),
                        attributes: expect.arrayContaining([
                            {name: 'size', value: '40'},
                            {name: 'color', value: 'black'},
                        ]),
                        quantity: 2,
                        originalUnitPrice: 1000,
                        unitPrice: 1000,
                        couponAllocation: 0,
                    },
                    {
                        variantId: second,
                        productId: product.id,
                        productName: product.name,
                        productSlug: product.slug,
                        imageKey: imageKeyOf(product.id),
                        attributes: expect.arrayContaining([
                            {name: 'size', value: '41'},
                            {name: 'color', value: 'white'},
                        ]),
                        quantity: 1,
                        originalUnitPrice: 2500,
                        unitPrice: 2500,
                        couponAllocation: 0,
                    },
                ],
                couponCode: null,
                couponStatus: 'none',
                subtotal: 4500,
                productDiscountTotal: 0,
                couponDiscount: 0,
                total: 4500,
            })
        })

        it('matches the totals shown by GET /cart', async () => {
            const product = await published([{price: 750, stock: 9}])
            await putInCart(user.api, product.variantIds[0], 4)

            const checkout = await getCheckoutCart.execute(user.userId)
            const cart = await getCart(user.api)

            expect(checkout.subtotal).toBe(cart.totals.subtotal)
            expect(checkout.total).toBe(cart.totals.total)
            expect(checkout.lines.map((l) => l.variantId)).toEqual(variantIdsInCart(cart))
        })

        it('uses the current catalog price', async () => {
            const product = await published([{price: 1000, stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await changeVariant(ctx.app, product.variants[0], {price: 1300})

            const checkout = await getCheckoutCart.execute(user.userId)

            expect(checkout.lines[0]).toMatchObject({unitPrice: 1300, originalUnitPrice: 1300, quantity: 2})
            expect(checkout.total).toBe(2600)
        })

        it('does not modify the cart', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 3)
            const before = await getCart(user.api)

            await getCheckoutCart.execute(user.userId)

            expect(await getCart(user.api)).toEqual(before)
        })

        describe('blocked checkouts', () => {
            it('rejects a user that never had a cart', async () => {
                const fresh = await createUserSession(ctx)

                await expect(getCheckoutCart.execute(fresh.userId)).rejects.toMatchObject(
                    blocked([{variantId: null, reason: 'empty'}]),
                )
            })

            it('rejects an emptied cart', async () => {
                const product = await published([{stock: 9}])
                await putInCart(user.api, product.variantIds[0])
                await user.api.delete('/cart')

                await expect(getCheckoutCart.execute(user.userId)).rejects.toMatchObject(
                    blocked([{variantId: null, reason: 'empty'}]),
                )
            })

            it.each([
                [
                    'outOfStock',
                    async (product: Awaited<ReturnType<typeof published>>) =>
                        changeVariant(ctx.app, product.variants[0], {stock: 0}),
                ],
                [
                    'insufficientStock',
                    async (product: Awaited<ReturnType<typeof published>>) =>
                        changeVariant(ctx.app, product.variants[0], {stock: 1}),
                ],
                [
                    'variantUnavailable',
                    async (product: Awaited<ReturnType<typeof published>>) =>
                        changeVariant(ctx.app, product.variants[0], {isActive: false}),
                ],
                [
                    'productUnavailable',
                    async (product: Awaited<ReturnType<typeof published>>) => unpublishProduct(admin, product.id),
                ],
            ])('rejects when a line is %s and names that line', async (reason, breakIt) => {
                const product = await published([{size: '40', stock: 9}, {size: '41', stock: 9}])
                await putInCart(user.api, product.variantIds[0], 3)
                await breakIt(product)

                await expect(getCheckoutCart.execute(user.userId)).rejects.toMatchObject(
                    blocked([{variantId: product.variantIds[0], reason}]),
                )
            })

            it('rejects a cart of an archived product', async () => {
                const product = await published([{stock: 9}])
                await putInCart(user.api, product.variantIds[0])
                await archiveProduct(admin, product.id)

                await expect(getCheckoutCart.execute(user.userId)).rejects.toMatchObject(
                    blocked([{variantId: product.variantIds[0], reason: 'productUnavailable'}]),
                )
            })

            it('lists every problem line but not the healthy ones', async () => {
                const product = await published([
                    {size: '40', stock: 9},
                    {size: '41', stock: 9},
                    {size: '42', stock: 9},
                ])
                const [healthy, soldOut, short] = product.variantIds
                await putInCart(user.api, healthy, 1)
                await putInCart(user.api, soldOut, 1)
                await putInCart(user.api, short, 4)
                await changeVariant(ctx.app, product.variants[1], {stock: 0})
                await changeVariant(ctx.app, product.variants[2], {stock: 2})

                await expect(getCheckoutCart.execute(user.userId)).rejects.toMatchObject(
                    blocked([
                        {variantId: soldOut, reason: 'outOfStock'},
                        {variantId: short, reason: 'insufficientStock'},
                    ]),
                )
            })

            it('becomes checkoutable again once the problem is fixed', async () => {
                const product = await published([{stock: 9}])
                await putInCart(user.api, product.variantIds[0], 2)
                await changeVariant(ctx.app, product.variants[0], {stock: 0})
                await expect(getCheckoutCart.execute(user.userId)).rejects.toMatchObject({
                    code: 'CART_CHECKOUT_BLOCKED',
                })

                await changeVariant(ctx.app, product.variants[0], {stock: 5})

                const checkout = await getCheckoutCart.execute(user.userId)
                expect(checkout.lines).toHaveLength(1)
                expect(checkout.lines[0].quantity).toBe(2)
            })
        })
    })

    describe('ClearCartAfterOrder', () => {
        it('empties the cart of the user', async () => {
            const product = await published([{size: '40', stock: 9}, {size: '41', stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await putInCart(user.api, product.variantIds[1], 1)

            await expect(clearCartAfterOrder.execute(user.userId)).resolves.toBeUndefined()

            expect(await getCart(user.api)).toEqual(EMPTY_CART)
        })

        it('resolves for a user that has no cart', async () => {
            const fresh = await createUserSession(ctx)

            await expect(clearCartAfterOrder.execute(fresh.userId)).resolves.toBeUndefined()
        })

        it('is idempotent', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0])

            await clearCartAfterOrder.execute(user.userId)
            await expect(clearCartAfterOrder.execute(user.userId)).resolves.toBeUndefined()

            expect(await getCart(user.api)).toEqual(EMPTY_CART)
        })

        it('also clears unavailable lines', async () => {
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await unpublishProduct(admin, product.id)

            await clearCartAfterOrder.execute(user.userId)

            expect(await getCart(user.api)).toEqual(EMPTY_CART)
        })

        it('does not touch the carts of other users', async () => {
            const other = await createUserSession(ctx)
            const product = await published([{stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await putInCart(other.api, product.variantIds[0], 3)

            await clearCartAfterOrder.execute(user.userId)

            expect(lineOf(await getCart(other.api), product.variantIds[0]).quantity).toBe(3)
        })

        it('leaves a cart that can be filled again and checked out afterwards', async () => {
            const product = await published([{price: 900, stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await clearCartAfterOrder.execute(user.userId)
            await expect(getCheckoutCart.execute(user.userId)).rejects.toMatchObject({code: 'CART_CHECKOUT_BLOCKED'})

            await putInCart(user.api, product.variantIds[0], 1)

            const checkout = await getCheckoutCart.execute(user.userId)
            expect(checkout.total).toBe(900)
        })
    })
})
