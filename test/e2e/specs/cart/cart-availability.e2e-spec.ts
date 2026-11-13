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
    publishProduct,
    unpublishProduct,
    VariantSeed,
} from '../product/product-test.util'
import {
    getCart,
    lineOf,
    putInCart,
} from './cart-test.util'

describe('Cart: availability and live catalog data (e2e)', () => {
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

    const published = (variants: VariantSeed[], options: { name?: string } = {}) =>
        createPublishedProduct(ctx.app, admin, {variants, ...options})

    const UNPRICED = {originalUnitPrice: null, unitPrice: null, lineTotal: null, couponAllocation: null}

    describe('prices and stock follow the catalog', () => {
        it('shows a price change immediately', async () => {
            const product = await published([{price: 1000, stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)

            await changeVariant(ctx.app, product.variants[0], {price: 1500})

            const cart = await getCart(user.api)
            expect(lineOf(cart, variantId)).toMatchObject({unitPrice: 1500, originalUnitPrice: 1500, lineTotal: 3000})
            expect(cart.totals).toMatchObject({subtotal: 3000, total: 3000})
        })

        it('flags a line whose quantity exceeds the remaining stock and exposes maxQuantity', async () => {
            const product = await published([{price: 1000, stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 4)

            await changeVariant(ctx.app, product.variants[0], {stock: 2})

            const cart = await getCart(user.api)
            expect(lineOf(cart, variantId)).toMatchObject({
                quantity: 4,
                available: false,
                unavailableReason: 'insufficientStock',
                maxQuantity: 2,
                ...UNPRICED,
            })
            expect(cart.hasUnavailableLines).toBe(true)
        })

        it('flags a sold-out line with maxQuantity 0', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)

            await changeVariant(ctx.app, product.variants[0], {stock: 0})

            expect(lineOf(await getCart(user.api), variantId)).toMatchObject({
                available: false,
                unavailableReason: 'outOfStock',
                maxQuantity: 0,
                ...UNPRICED,
            })
        })

        it('makes the line available again when the stock comes back', async () => {
            const product = await published([{price: 800, stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 3)
            await changeVariant(ctx.app, product.variants[0], {stock: 0})
            expect(lineOf(await getCart(user.api), variantId).available).toBe(false)

            await changeVariant(ctx.app, product.variants[0], {stock: 5})

            const cart = await getCart(user.api)
            expect(lineOf(cart, variantId)).toMatchObject({
                available: true,
                unavailableReason: null,
                maxQuantity: 5,
                lineTotal: 2400,
            })
            expect(cart.hasUnavailableLines).toBe(false)
        })

        it('keeps the quantity untouched while the line is unavailable', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 6)

            await changeVariant(ctx.app, product.variants[0], {stock: 1})
            await changeVariant(ctx.app, product.variants[0], {stock: 9})

            expect(lineOf(await getCart(user.api), variantId).quantity).toBe(6)
        })

        it('shows changed attributes (normalised) on the line', async () => {
            const product = await published([{size: '40', color: 'black', stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId)

            await changeVariant(ctx.app, product.variants[0], {
                attributes: [
                    {name: ' Size ', value: '41'},
                    {name: 'COLOR', value: 'White'},
                ],
            })

            expect(lineOf(await getCart(user.api), variantId).attributes).toEqual(
                expect.arrayContaining([
                    {name: 'size', value: '41'},
                    {name: 'color', value: 'white'},
                ]),
            )
        })
    })

    describe('totals with unavailable lines', () => {
        it('counts unavailable quantities in itemCount but leaves them out of the money totals', async () => {
            const product = await published([
                {size: '40', price: 1000, stock: 9},
                {size: '41', price: 5000, stock: 9},
            ])
            const [good, broken] = product.variantIds
            await putInCart(user.api, good, 1)
            await putInCart(user.api, broken, 4)

            await changeVariant(ctx.app, product.variants[1], {stock: 0})

            const cart = await getCart(user.api)
            expect(cart.totals).toEqual({
                itemCount: 5,
                subtotal: 1000,
                productDiscountTotal: 0,
                couponDiscount: 0,
                total: 1000,
            })
            expect(lineOf(cart, good)).toMatchObject({available: true, lineTotal: 1000})
            expect(lineOf(cart, broken)).toMatchObject({available: false, ...UNPRICED})
        })

        it('has zero money totals when every line is unavailable', async () => {
            const product = await published([{price: 1000, stock: 9}])
            await putInCart(user.api, product.variantIds[0], 2)
            await changeVariant(ctx.app, product.variants[0], {stock: 0})

            const cart = await getCart(user.api)

            expect(cart.totals).toEqual({
                itemCount: 2,
                subtotal: 0,
                productDiscountTotal: 0,
                couponDiscount: 0,
                total: 0,
            })
        })
    })

    describe('inactive variants', () => {
        it('flags a deactivated variant of a still-published product', async () => {
            const product = await published([{size: '40', stock: 9}, {size: '41', stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)

            await changeVariant(ctx.app, product.variants[0], {isActive: false})

            expect(lineOf(await getCart(user.api), variantId)).toMatchObject({
                available: false,
                unavailableReason: 'variantUnavailable',
                maxQuantity: 0,
                product: {id: product.id, name: product.name, slug: product.slug, imageKey: imageKeyOf(product.id)},
                ...UNPRICED,
            })
        })

        it('reports variantUnavailable (and no product details) when the last variant was deactivated', async () => {
            // deactivating the only active variant also unpublishes the product (catalog rule)
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 1)

            await changeVariant(ctx.app, product.variants[0], {isActive: false})

            expect(lineOf(await getCart(user.api), variantId)).toMatchObject({
                available: false,
                unavailableReason: 'variantUnavailable',
                maxQuantity: 0,
                product: {id: product.id, name: null, slug: null, imageKey: null},
            })
        })
    })

    describe('product status', () => {
        it('flags lines of an unpublished product and recovers when it is published again', async () => {
            const product = await published([{price: 1200, stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)

            await unpublishProduct(admin, product.id)

            const hidden = lineOf(await getCart(user.api), variantId)
            expect(hidden).toMatchObject({
                quantity: 2,
                available: false,
                unavailableReason: 'productUnavailable',
                product: {id: product.id, name: null, slug: null, imageKey: null},
                ...UNPRICED,
            })
            // the stock is still there, so maxQuantity keeps reflecting it
            expect(hidden.maxQuantity).toBe(9)

            await publishProduct(admin, product.id)

            expect(lineOf(await getCart(user.api), variantId)).toMatchObject({
                available: true,
                unavailableReason: null,
                product: {id: product.id, name: product.name, slug: product.slug},
                lineTotal: 2400,
            })
        })

        it('flags lines of an archived product', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId)

            await archiveProduct(admin, product.id)

            expect(lineOf(await getCart(user.api), variantId)).toMatchObject({
                available: false,
                unavailableReason: 'productUnavailable',
            })
        })

        it('keeps unavailable lines in the cart until the user removes them', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId, 2)
            await unpublishProduct(admin, product.id)

            for (let i = 0; i < 2; i++) {
                expect(lineOf(await getCart(user.api), variantId)).toBeDefined()
            }
        })
    })

    describe('product details follow the catalog', () => {
        it('shows a renamed product', async () => {
            const product = await published([{stock: 9}])
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId)

            const res = await admin.patch(`/admin/products/${product.id}`, {name: 'Renamed in catalog'})
            expect(res.statusCode).toBe(200)

            expect(lineOf(await getCart(user.api), variantId).product).toMatchObject({
                id: product.id,
                name: 'Renamed in catalog',
                slug: product.slug,
            })
        })

        it('uses the first gallery image as imageKey and follows reordering', async () => {
            const product = await createPublishedProduct(ctx.app, admin, {variants: [{stock: 9}], images: 2})
            const variantId = product.variantIds[0]
            await putInCart(user.api, variantId)
            expect(lineOf(await getCart(user.api), variantId).product.imageKey).toBe(imageKeyOf(product.id, 0))

            await admin.put(`/admin/products/${product.id}/gallery`, {
                images: [{fileKey: imageKeyOf(product.id, 1)}, {fileKey: imageKeyOf(product.id, 0)}],
            })

            expect(lineOf(await getCart(user.api), variantId).product.imageKey).toBe(imageKeyOf(product.id, 1))
        })
    })
})
