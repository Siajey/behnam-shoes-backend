import {afterEach, beforeAll, beforeEach, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {
    Api,
    UserSession,
    anonymousApi,
    apiWithoutCsrf,
    createUserSession,
    expectError,
    expectOk,
    expectValidationError,
    randomId,
    uid,
} from '../../util/test.util'
import {changeVariant, createBrand, createCategory, createPublishedProduct} from '../product/product-test.util'
import {
    DAY,
    createCoupon,
    discountTracker,
    discountUseCases,
    isoFromNow,
    scope,
} from '../discount/discount-test.util'
import {EMPTY_CART, cartSystemUseCases, getCart, lineOf, putInCart} from './cart-test.util'

describe('Cart: discounts and coupons (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession
    let discounts: ReturnType<typeof discountTracker>
    let checkout: ReturnType<typeof cartSystemUseCases>['getCheckoutCart']
    let redemptions: ReturnType<typeof discountUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
        discounts = discountTracker(admin)
        checkout = cartSystemUseCases(ctx.app).getCheckoutCart
        redemptions = discountUseCases(ctx.app)
    })

    beforeEach(async () => {
        await user.api.delete('/cart')
    })

    afterEach(async () => {
        await discounts.cleanup()
    })

    const product = (price = 1000, options: Record<string, unknown> = {}) =>
        createPublishedProduct(ctx.app, admin, {variants: [{price, stock: 50}], ...options})

    const applyCoupon = (api: Api, code: string) => api.put('/cart/coupon', {code})
    const applied = async (code: string) => {
        const res = await applyCoupon(user.api, code)
        expectOk(res, 200, 'CART_APPLY_COUPON_SUCCESS')
        return res.json().data
    }
    const NO_COUPON = {code: null, status: 'none', invalidReason: null}

    describe('product discounts in the cart', () => {
        it('shows the discounted price, the original price and the totals', async () => {
            const p = await product(1000)
            const d = await discounts.create({value: 10, scope: scope('variant', p.variantIds[0])})

            const cart = await putInCart(user.api, p.variantIds[0], 2)

            expect(lineOf(cart, p.variantIds[0])).toMatchObject({
                originalUnitPrice: 1000,
                unitPrice: 900,
                lineTotal: 1800,
                couponAllocation: 0,
            })
            expect(cart.totals).toEqual({itemCount: 2, subtotal: 2000, productDiscountTotal: 200, couponDiscount: 0, total: 1800})
            expect(d.id).toBeDefined()
        })

        it('applies product, brand and category scoped discounts to the matching products', async () => {
            const brand = await createBrand(admin)
            const category = await createCategory(admin)
            const byProduct = await product(1000)
            const byBrand = await product(1000, {brandId: brand.id})
            const byCategory = await product(1000, {categoryId: category.id})
            const untouched = await product(1000)
            await discounts.create({value: 10, scope: scope('product', byProduct.id)})
            await discounts.create({value: 20, scope: scope('brand', brand.id)})
            await discounts.create({value: 30, scope: scope('category', category.id)})
            for (const p of [byProduct, byBrand, byCategory, untouched]) await putInCart(user.api, p.variantIds[0])

            const cart = await getCart(user.api)

            expect([byProduct, byBrand, byCategory, untouched].map((p) => lineOf(cart, p.variantIds[0]).unitPrice)).toEqual([
                900, 800, 700, 1000,
            ])
        })

        it('follows admin edits, deactivation and deletion on the next read', async () => {
            const p = await product(1000)
            const d = await discounts.create({value: 10, scope: scope('variant', p.variantIds[0])})
            await putInCart(user.api, p.variantIds[0])
            const unit = async () => lineOf(await getCart(user.api), p.variantIds[0]).unitPrice

            expect(await unit()).toBe(900)
            await admin.patch(`/admin/discounts/${d.id}`, {value: 50})
            expect(await unit()).toBe(500)
            await admin.patch(`/admin/discounts/${d.id}`, {isActive: false})
            expect(await unit()).toBe(1000)
            await admin.patch(`/admin/discounts/${d.id}`, {isActive: true})
            await admin.delete(`/admin/discounts/${d.id}`)
            expect(await unit()).toBe(1000)
        })

        it('follows catalog price changes together with the discount', async () => {
            const p = await product(1000)
            await discounts.create({value: 10, scope: scope('variant', p.variantIds[0])})
            await putInCart(user.api, p.variantIds[0])

            await changeVariant(ctx.app, p.variants[0], {price: 2000})

            expect(lineOf(await getCart(user.api), p.variantIds[0])).toMatchObject({originalUnitPrice: 2000, unitPrice: 1800})
        })
    })

    describe('PUT /cart/coupon', () => {
        it('applies a coupon and returns the priced cart', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, p.variantIds[0], 2)

            const cart = await applied(coupon.code)

            expect(cart.coupon).toEqual({code: coupon.code, status: 'applied', invalidReason: null})
            expect(cart.totals).toEqual({itemCount: 2, subtotal: 2000, productDiscountTotal: 0, couponDiscount: 200, total: 1800})
            expect(lineOf(cart, p.variantIds[0])).toMatchObject({unitPrice: 1000, lineTotal: 2000, couponAllocation: 200})
            expect(await getCart(user.api)).toEqual(cart)
        })

        it('stores the normalised code', async () => {
            const p = await product()
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])

            const cart = await applied(`  ${coupon.code.toLowerCase()} `)

            expect(cart.coupon.code).toBe(coupon.code)
        })

        it('spreads the coupon over eligible lines and skips already discounted ones', async () => {
            const [discounted, plain] = [await product(1000), await product(1000)]
            await discounts.create({value: 50, scope: scope('variant', discounted.variantIds[0])})
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, discounted.variantIds[0])
            await putInCart(user.api, plain.variantIds[0])

            const cart = await applied(coupon.code)

            expect(cart.totals).toMatchObject({subtotal: 2000, productDiscountTotal: 500, couponDiscount: 100, total: 1400})
            expect(lineOf(cart, discounted.variantIds[0]).couponAllocation).toBe(0)
            expect(lineOf(cart, plain.variantIds[0]).couponAllocation).toBe(100)
        })

        it('caps the coupon with maxDiscount and clamps fixed coupons to the cart total', async () => {
            const p = await product(1000)
            const capped = await createCoupon(admin, {value: 50, maxDiscount: 100})
            const huge = await createCoupon(admin, {kind: 'fixed', value: 99999})
            await putInCart(user.api, p.variantIds[0])

            expect((await applied(capped.code)).totals).toMatchObject({couponDiscount: 100, total: 900})
            expect((await applied(huge.code)).totals).toMatchObject({couponDiscount: 1000, total: 0})
        })

        it('replaces a previously applied coupon', async () => {
            const p = await product(1000)
            const [first, second] = [await createCoupon(admin, {value: 10}), await createCoupon(admin, {value: 20})]
            await putInCart(user.api, p.variantIds[0])

            await applied(first.code)
            const cart = await applied(second.code)

            expect(cart.coupon.code).toBe(second.code)
            expect(cart.totals.couponDiscount).toBe(200)
        })

        it('does not touch the carts of other users', async () => {
            const other = await createUserSession(ctx)
            const p = await product()
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await putInCart(other.api, p.variantIds[0])

            await applied(coupon.code)

            expect((await getCart(other.api)).coupon).toEqual(NO_COUPON)
        })

        describe('rejected coupons', () => {
            const rejections: [string, (p: { id: string }) => Promise<string>][] = [
                ['an unknown code', async () => `NOPE${uid().toUpperCase()}`],
                ['an inactive coupon', async () => (await createCoupon(admin, {isActive: false})).code],
                ['a coupon that has not started', async () => (await createCoupon(admin, {startsAt: isoFromNow(DAY)})).code],
                [
                    'an expired coupon',
                    async () => (await createCoupon(admin, {startsAt: isoFromNow(-2 * DAY), endsAt: isoFromNow(-DAY)})).code,
                ],
                ['a minimum order that is not met', async () => (await createCoupon(admin, {minOrderAmount: 5000})).code],
                ['a coupon without eligible items', async () => (await createCoupon(admin, {scope: scope('brand', randomId())})).code],
                [
                    'a coupon whose total limit is reached',
                    async () => {
                        const coupon = await createCoupon(admin, {usageLimitTotal: 1})
                        const other = await createUserSession(ctx)
                        await redemptions.reserveCoupon.execute({couponId: coupon.id, userId: other.userId, orderId: randomId(), discountAmount: 1})
                        return coupon.code
                    },
                ],
                [
                    'a coupon whose per-user limit is reached',
                    async () => {
                        const coupon = await createCoupon(admin, {usageLimitPerUser: 1})
                        await redemptions.reserveCoupon.execute({couponId: coupon.id, userId: user.userId, orderId: randomId(), discountAmount: 1})
                        return coupon.code
                    },
                ],
            ]

            it.each(rejections)('answers 409 CART_COUPON_INVALID for %s and does not store it', async (_label, arrange) => {
                const p = await product(1000)
                await putInCart(user.api, p.variantIds[0])
                const code = await arrange(p)

                expectError(await applyCoupon(user.api, code), 409, 'CART_COUPON_INVALID')

                expect((await getCart(user.api)).coupon).toEqual(NO_COUPON)
            })

            it('keeps the previously applied coupon when the new one is rejected', async () => {
                const p = await product(1000)
                const good = await createCoupon(admin)
                await putInCart(user.api, p.variantIds[0])
                await applied(good.code)

                expectError(await applyCoupon(user.api, 'UNKNOWN-CODE'), 409, 'CART_COUPON_INVALID')

                expect((await getCart(user.api)).coupon).toMatchObject({code: good.code, status: 'applied'})
            })

            it('rejects a coupon on an empty cart', async () => {
                const coupon = await createCoupon(admin)

                expectError(await applyCoupon(user.api, coupon.code), 409, 'CART_COUPON_INVALID')
                expect(await getCart(user.api)).toEqual(EMPTY_CART)
            })
        })

        it.each([
            ['a missing code', {}],
            ['a code under 3 characters', {code: 'AB'}],
            ['a code over 30 characters', {code: 'A'.repeat(31)}],
            ['a blank code', {code: '   '}],
            ['a non-string code', {code: 12345}],
        ])('rejects %s with a validation error', async (_label, body) => {
            expectValidationError(await user.api.put('/cart/coupon', body))
        })
    })

    describe('DELETE /cart/coupon', () => {
        it('removes the coupon and recalculates the totals', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)

            const res = await user.api.delete('/cart/coupon')

            expectOk(res, 200, 'CART_REMOVE_COUPON_SUCCESS')
            expect(res.json().data.coupon).toEqual(NO_COUPON)
            expect(res.json().data.totals).toMatchObject({couponDiscount: 0, total: 1000})
            expect(lineOf(res.json().data, p.variantIds[0]).couponAllocation).toBe(0)
            expect(await getCart(user.api)).toEqual(res.json().data)
        })

        it('is idempotent and works for a user without a cart', async () => {
            const fresh = await createUserSession(ctx)

            for (let i = 0; i < 2; i++) {
                const res = await fresh.api.delete('/cart/coupon')
                expectOk(res, 200, 'CART_REMOVE_COUPON_SUCCESS')
                expect(res.json().data).toEqual(EMPTY_CART)
            }
        })

        it('leaves the items untouched', async () => {
            const p = await product()
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0], 3)
            await applied(coupon.code)

            const res = await user.api.delete('/cart/coupon')

            expect(lineOf(res.json().data, p.variantIds[0]).quantity).toBe(3)
        })

        it('is also done by clearing the whole cart', async () => {
            const p = await product()
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)

            await user.api.delete('/cart')
            await putInCart(user.api, p.variantIds[0])

            expect((await getCart(user.api)).coupon).toEqual(NO_COUPON)
        })
    })

    describe('a coupon that stays in the cart', () => {
        it('is recalculated when the cart changes', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, p.variantIds[0], 2)
            await applied(coupon.code)

            const res = await user.api.patch(`/cart/items/${p.variantIds[0]}`, {quantity: 5})

            expect(res.json().data.totals).toMatchObject({subtotal: 5000, couponDiscount: 500, total: 4500})
        })

        it('is shown as invalid with its reason, without a discount, when it stops being valid', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)

            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})

            const cart = await getCart(user.api)
            expect(cart.coupon).toEqual({code: coupon.code, status: 'invalid', invalidReason: 'inactive'})
            expect(cart.totals).toMatchObject({couponDiscount: 0, total: 1000})
            expect(lineOf(cart, p.variantIds[0]).couponAllocation).toBe(0)
            expect(cart.hasUnavailableLines).toBe(false)
        })

        it.each([
            ['expired', {endsAt: isoFromNow(-DAY), startsAt: isoFromNow(-2 * DAY)}],
            ['notStarted', {startsAt: isoFromNow(DAY)}],
            ['minOrderNotMet', {minOrderAmount: 999999}],
            ['noEligibleItems', {scope: scope('brand', randomId())}],
        ])('reports %s after the coupon is edited', async (reason, changes) => {
            const p = await product(1000)
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)

            await admin.patch(`/admin/coupons/${coupon.id}`, changes)

            expect((await getCart(user.api)).coupon).toEqual({code: coupon.code, status: 'invalid', invalidReason: reason})
        })

        it('reports notFound when the coupon is deleted and totalLimitReached when others use it up', async () => {
            const p = await product(1000)
            const deleted = await createCoupon(admin)
            const limited = await createCoupon(admin, {usageLimitTotal: 1})
            await putInCart(user.api, p.variantIds[0])

            await applied(deleted.code)
            await admin.delete(`/admin/coupons/${deleted.id}`)
            expect((await getCart(user.api)).coupon).toMatchObject({status: 'invalid', invalidReason: 'notFound'})

            await applied(limited.code)
            const other = await createUserSession(ctx)
            await redemptions.reserveCoupon.execute({couponId: limited.id, userId: other.userId, orderId: randomId(), discountAmount: 1})
            expect((await getCart(user.api)).coupon).toMatchObject({code: limited.code, invalidReason: 'totalLimitReached'})
        })

        it('becomes valid again without re-applying once the problem is fixed', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)
            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})
            expect((await getCart(user.api)).coupon.status).toBe('invalid')

            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: true})

            const cart = await getCart(user.api)
            expect(cart.coupon).toEqual({code: coupon.code, status: 'applied', invalidReason: null})
            expect(cart.totals.couponDiscount).toBe(100)
        })

        it('turns invalid when the cart is emptied and applied again when items return', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)

            await user.api.delete(`/cart/items/${p.variantIds[0]}`)
            expect((await getCart(user.api)).coupon).toMatchObject({code: coupon.code, status: 'invalid', invalidReason: 'noEligibleItems'})

            await putInCart(user.api, p.variantIds[0])
            expect((await getCart(user.api)).coupon.status).toBe('applied')
        })
    })

    describe('checkout', () => {
        const blocked = (problems: { variantId: string | null; reason: string }[]) => ({
            code: 'CART_CHECKOUT_BLOCKED',
            status: 409,
            details: {problems},
        })

        it('returns the coupon and the discounts in the checkout cart', async () => {
            const [discounted, plain] = [await product(1000), await product(2000)]
            await discounts.create({value: 50, scope: scope('variant', discounted.variantIds[0])})
            const coupon = await createCoupon(admin, {value: 10})
            await putInCart(user.api, discounted.variantIds[0])
            await putInCart(user.api, plain.variantIds[0])
            await applied(coupon.code)

            const result = await checkout.execute(user.userId)

            expect(result).toMatchObject({
                couponCode: coupon.code,
                couponStatus: 'applied',
                subtotal: 3000,
                productDiscountTotal: 500,
                couponDiscount: 200,
                total: 2300,
            })
            expect(result.lines.map((l) => [l.originalUnitPrice, l.unitPrice, l.couponAllocation])).toEqual([
                [1000, 500, 0],
                [2000, 2000, 200],
            ])
        })

        it('has no coupon fields set when none was applied', async () => {
            const p = await product(1000)
            await putInCart(user.api, p.variantIds[0])

            expect(await checkout.execute(user.userId)).toMatchObject({couponCode: null, couponStatus: 'none', couponDiscount: 0, total: 1000})
        })

        it('is blocked while the coupon is invalid and allowed again after removing it', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)
            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})

            await expect(checkout.execute(user.userId)).rejects.toMatchObject(blocked([{variantId: null, reason: 'couponInvalid'}]))

            await user.api.delete('/cart/coupon')
            await expect(checkout.execute(user.userId)).resolves.toMatchObject({couponStatus: 'none', total: 1000})
        })

        it('is allowed again when the coupon becomes valid', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)
            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})
            await expect(checkout.execute(user.userId)).rejects.toMatchObject({code: 'CART_CHECKOUT_BLOCKED'})

            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: true})

            await expect(checkout.execute(user.userId)).resolves.toMatchObject({couponStatus: 'applied'})
        })

        it('reports an invalid coupon before unavailable lines', async () => {
            const p = await product(1000)
            const coupon = await createCoupon(admin)
            await putInCart(user.api, p.variantIds[0])
            await applied(coupon.code)
            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})
            await changeVariant(ctx.app, p.variants[0], {stock: 0})

            await expect(checkout.execute(user.userId)).rejects.toMatchObject(blocked([{variantId: null, reason: 'couponInvalid'}]))
        })
    })

    describe('access', () => {
        it.each([
            ['PUT', () => anonymousApi(ctx.app).put('/cart/coupon', {code: 'ABC123'})],
            ['DELETE', () => anonymousApi(ctx.app).delete('/cart/coupon')],
        ])('%s /cart/coupon is rejected without a session', async (_method, call) => {
            expect([401, 403]).toContain((await call()).statusCode)
        })

        it.each([
            ['PUT', (api: Api) => api.put('/cart/coupon', {code: 'ABC123'})],
            ['DELETE', (api: Api) => api.delete('/cart/coupon')],
        ])('%s /cart/coupon is rejected without the CSRF header', async (_method, call) => {
            const res = await call(apiWithoutCsrf(ctx.app, user.session))

            expect([401, 403]).toContain(res.statusCode)
        })
    })
})
