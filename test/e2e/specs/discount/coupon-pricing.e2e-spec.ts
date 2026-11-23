import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, UserSession, createUserSession, randomId, uid} from '../../util/test.util'
import {
    ALL,
    DAY,
    createCoupon,
    discountTracker,
    discountUseCases,
    isoFromNow,
    line,
    scope,
    TestLine,
} from './discount-test.util'

describe('Pricing: coupons (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let user: UserSession
    let other: UserSession
    let discounts: ReturnType<typeof discountTracker>
    let uc: ReturnType<typeof discountUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = (await createUserSession(ctx, UserRole.ADMIN)).api
        user = await createUserSession(ctx)
        other = await createUserSession(ctx)
        discounts = discountTracker(admin)
        uc = discountUseCases(ctx.app)
    })

    afterEach(async () => {
        await discounts.cleanup()
    })

    const price = (lines: TestLine[], couponCode: string | null, userId = user.userId) =>
        uc.priceItems.execute({userId, lines, couponCode})

    const reserve = (couponId: string, userId: string, orderId = randomId()) =>
        uc.reserveCoupon.execute({couponId, userId, orderId, discountAmount: 100}).then(() => orderId)

    const allocations = (result: Awaited<ReturnType<typeof price>>) => result.lines.map((l) => l.couponAllocation)
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

    describe('outcome', () => {
        it('is "none" without a code and leaves allocations at zero', async () => {
            const result = await price([line(), line()], null)

            expect(result.coupon).toEqual({status: 'none'})
            expect(allocations(result)).toEqual([0, 0])
        })

        it('is invalid/notFound for an unknown code, echoing the normalised input', async () => {
            const result = await price([line()], ' nope123 ')

            expect(result.coupon).toEqual({status: 'invalid', code: 'NOPE123', reason: 'notFound'})
        })

        it('applies a percent coupon and spreads it proportionally over the lines', async () => {
            const coupon = await createCoupon(admin, {value: 10})
            const lines = [line({unitPrice: 1000}), line({unitPrice: 2000})]

            const result = await price(lines, coupon.code)

            expect(result.coupon).toEqual({status: 'applied', couponId: coupon.id, code: coupon.code, discount: 300})
            expect(allocations(result)).toEqual([100, 200])
            // the coupon never changes unit prices, only the allocation
            expect(result.lines.map((l) => l.unitPrice)).toEqual([1000, 2000])
        })

        it('uses line totals (unit price x quantity) as the base', async () => {
            const coupon = await createCoupon(admin, {value: 10})

            const result = await price([line({unitPrice: 1000, quantity: 3}), line({unitPrice: 500, quantity: 2})], coupon.code)

            expect(result.coupon).toMatchObject({status: 'applied', discount: 400}) // 10% of 3000 + 1000
            expect(allocations(result)).toEqual([300, 100])
        })

        it('floors percent amounts', async () => {
            const coupon = await createCoupon(admin, {value: 10})

            const result = await price([line({unitPrice: 999})], coupon.code)

            expect(result.coupon).toMatchObject({status: 'applied', discount: 99})
        })

        it('applies a fixed coupon, clamped to the eligible total', async () => {
            const fixed = await createCoupon(admin, {kind: 'fixed', value: 300})
            const huge = await createCoupon(admin, {kind: 'fixed', value: 99999})

            expect((await price([line({unitPrice: 1000})], fixed.code)).coupon).toMatchObject({discount: 300})
            expect((await price([line({unitPrice: 1000})], huge.code)).coupon).toMatchObject({discount: 1000})
        })

        it('caps the discount with maxDiscount', async () => {
            const coupon = await createCoupon(admin, {value: 50, maxDiscount: 400})

            const result = await price([line({unitPrice: 1000}), line({unitPrice: 1000})], coupon.code)

            expect(result.coupon).toMatchObject({discount: 400})
            expect(allocations(result)).toEqual([200, 200])
        })

        it('matches the code regardless of case, spaces and Persian digits', async () => {
            const tag = uid()
            const coupon = await createCoupon(admin, {code: `SALE2026${tag.toUpperCase()}`})

            const result = await price([line()], ` sale\u06F2\u06F0\u06F2\u06F6${tag} `)

            expect(result.coupon).toMatchObject({status: 'applied', code: coupon.code})
        })
    })

    describe('allocation', () => {
        it('splits the remainder deterministically so the shares add up exactly', async () => {
            const equal = await createCoupon(admin, {kind: 'fixed', value: 100})
            const result = await price([line(), line(), line()], equal.code)
            expect(allocations(result)).toEqual([34, 33, 33])

            const uneven = await createCoupon(admin, {kind: 'fixed', value: 100})
            const unevenResult = await price([line({unitPrice: 1000}), line({unitPrice: 2000})], uneven.code)
            expect(allocations(unevenResult)).toEqual([33, 67])
        })

        it('stays exact for very large amounts', async () => {
            const coupon = await createCoupon(admin, {kind: 'fixed', value: 1_000_000_000_001})

            const result = await price(
                [line({unitPrice: 4_000_000_000_000}), line({unitPrice: 6_000_000_000_000})],
                coupon.code,
            )

            expect(result.coupon).toMatchObject({discount: 1_000_000_000_001})
            expect(allocations(result)).toEqual([400_000_000_000, 600_000_000_001])
            expect(sum(allocations(result))).toBe(1_000_000_000_001)
        })

        it.each([[7], [101], [999], [12345]])('always sums to the discount (fixed %d over odd lines)', async (value) => {
            const coupon = await createCoupon(admin, {kind: 'fixed', value})
            const lines = [line({unitPrice: 333}), line({unitPrice: 777, quantity: 3}), line({unitPrice: 1})]

            const result = await price(lines, coupon.code)

            expect(result.coupon.status).toBe('applied')
            expect(sum(allocations(result))).toBe((result.coupon as any).discount)
        })
    })

    describe('eligibility', () => {
        it('only allocates to lines inside the coupon scope', async () => {
            const productId = randomId()
            const coupon = await createCoupon(admin, {value: 10, scope: scope('product', productId)})
            const lines = [line({productId, unitPrice: 1000}), line({unitPrice: 5000})]

            const result = await price(lines, coupon.code)

            expect(result.coupon).toMatchObject({status: 'applied', discount: 100})
            expect(allocations(result)).toEqual([100, 0])
        })

        it('reports noEligibleItems when no line is in scope', async () => {
            const coupon = await createCoupon(admin, {scope: scope('brand', randomId())})

            expect((await price([line()], coupon.code)).coupon).toEqual({
                status: 'invalid',
                code: coupon.code,
                reason: 'noEligibleItems',
            })
        })

        it('reports noEligibleItems for an empty cart', async () => {
            const coupon = await createCoupon(admin)

            expect((await price([], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'noEligibleItems'})
        })

        describe('lines that already have a product discount', () => {
            it('are excluded by default (applyToDiscountedItems=false)', async () => {
                const discounted = line({unitPrice: 1000})
                const plain = line({unitPrice: 1000})
                await discounts.create({value: 50, scope: scope('variant', discounted.variantId)})
                const coupon = await createCoupon(admin, {value: 10})

                const result = await price([discounted, plain], coupon.code)

                expect(result.coupon).toMatchObject({status: 'applied', discount: 100})
                expect(allocations(result)).toEqual([0, 100])
            })

            it('are included when applyToDiscountedItems=true, on their discounted price', async () => {
                const discounted = line({unitPrice: 1000})
                const plain = line({unitPrice: 1000})
                await discounts.create({value: 50, scope: scope('variant', discounted.variantId)})
                const coupon = await createCoupon(admin, {value: 10, applyToDiscountedItems: true})

                const result = await price([discounted, plain], coupon.code)

                expect(result.coupon).toMatchObject({status: 'applied', discount: 150}) // 10% of 500 + 1000
                expect(allocations(result)).toEqual([50, 100])
            })

            it('leave the coupon with noEligibleItems when every line is discounted', async () => {
                const l = line()
                await discounts.create({value: 50, scope: scope('variant', l.variantId)})
                const coupon = await createCoupon(admin)

                expect((await price([l], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'noEligibleItems'})
            })
        })

        it('reports noEligibleItems when the eligible total is zero', async () => {
            const l = line()
            await discounts.create({value: 100, scope: scope('variant', l.variantId)})
            const coupon = await createCoupon(admin, {applyToDiscountedItems: true})

            expect((await price([l], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'noEligibleItems'})
        })
    })

    describe('minimum order amount', () => {
        it('is compared against the total after product discounts', async () => {
            const l = line({unitPrice: 1000})
            await discounts.create({value: 10, scope: scope('variant', l.variantId)}) // 900 after discount
            const tooHigh = await createCoupon(admin, {minOrderAmount: 1000, applyToDiscountedItems: true})
            const exact = await createCoupon(admin, {minOrderAmount: 900, applyToDiscountedItems: true})

            expect((await price([l], tooHigh.code)).coupon).toMatchObject({status: 'invalid', reason: 'minOrderNotMet'})
            expect((await price([l], exact.code)).coupon).toMatchObject({status: 'applied'})
        })

        it('counts the whole order, not only the eligible lines', async () => {
            const productId = randomId()
            const coupon = await createCoupon(admin, {value: 10, minOrderAmount: 5000, scope: scope('product', productId)})
            const lines = [line({productId, unitPrice: 1000}), line({unitPrice: 4000})]

            expect((await price(lines, coupon.code)).coupon).toMatchObject({status: 'applied', discount: 100})
            expect((await price([lines[0]], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'minOrderNotMet'})
        })
    })

    describe('validity', () => {
        it.each([
            ['inactive', {isActive: false}],
            ['notStarted', {startsAt: isoFromNow(DAY)}],
            ['expired', {startsAt: isoFromNow(-2 * DAY), endsAt: isoFromNow(-DAY)}],
        ])('is invalid/%s', async (reason, overrides) => {
            const coupon = await createCoupon(admin, overrides)

            expect((await price([line()], coupon.code)).coupon).toEqual({status: 'invalid', code: coupon.code, reason})
        })

        it('is valid inside its period and when open-ended', async () => {
            const windowed = await createCoupon(admin, {startsAt: isoFromNow(-DAY), endsAt: isoFromNow(DAY)})
            const open = await createCoupon(admin, {startsAt: isoFromNow(-DAY)})

            expect((await price([line()], windowed.code)).coupon.status).toBe('applied')
            expect((await price([line()], open.code)).coupon.status).toBe('applied')
        })

        it('reports "inactive" before other reasons', async () => {
            const coupon = await createCoupon(admin, {isActive: false, startsAt: isoFromNow(DAY)})

            expect((await price([line()], coupon.code)).coupon).toMatchObject({reason: 'inactive'})
        })

        it('follows admin edits immediately', async () => {
            const coupon = await createCoupon(admin)
            expect((await price([line()], coupon.code)).coupon.status).toBe('applied')

            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: false})
            expect((await price([line()], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'inactive'})

            await admin.patch(`/admin/coupons/${coupon.id}`, {isActive: true, value: 20})
            expect((await price([line({unitPrice: 1000})], coupon.code)).coupon).toMatchObject({status: 'applied', discount: 200})

            await admin.delete(`/admin/coupons/${coupon.id}`)
            expect((await price([line()], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'notFound'})
        })
    })

    describe('usage limits', () => {
        it('blocks the coupon once the total limit is reached, counting reserved and committed but not released', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 2})
            const first = await reserve(coupon.id, user.userId)
            expect((await price([line()], coupon.code)).coupon.status).toBe('applied')

            const second = await reserve(coupon.id, other.userId)
            expect((await price([line()], coupon.code)).coupon).toMatchObject({status: 'invalid', reason: 'totalLimitReached'})

            await uc.releaseRedemption.execute(first)
            expect((await price([line()], coupon.code)).coupon.status).toBe('applied')

            await uc.commitRedemption.execute(second)
            await reserve(coupon.id, user.userId)
            expect((await price([line()], coupon.code)).coupon).toMatchObject({reason: 'totalLimitReached'})
        })

        it('blocks only the user who reached the per-user limit', async () => {
            const coupon = await createCoupon(admin, {usageLimitPerUser: 1})
            await reserve(coupon.id, user.userId)

            expect((await price([line()], coupon.code, user.userId)).coupon).toMatchObject({
                status: 'invalid',
                reason: 'userLimitReached',
            })
            expect((await price([line()], coupon.code, other.userId)).coupon.status).toBe('applied')
        })

        it('checks the total limit before the per-user limit', async () => {
            const coupon = await createCoupon(admin, {usageLimitTotal: 1, usageLimitPerUser: 1})
            await reserve(coupon.id, user.userId)

            expect((await price([line()], coupon.code, user.userId)).coupon).toMatchObject({reason: 'totalLimitReached'})
        })
    })

    it('does not change unit prices or product discounts', async () => {
        const l = line({unitPrice: 1000})
        const d = await discounts.create({value: 20, scope: scope('variant', l.variantId)})
        const coupon = await createCoupon(admin, {value: 10, applyToDiscountedItems: true, scope: ALL})

        const result = await price([l], coupon.code)

        expect(result.lines[0]).toEqual({
            variantId: l.variantId,
            originalUnitPrice: 1000,
            unitPrice: 800,
            appliedDiscountIds: [d.id],
            couponAllocation: 80,
        })
    })
})
