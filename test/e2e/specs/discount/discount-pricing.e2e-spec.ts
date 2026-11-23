import {afterEach, beforeAll, describe, expect, it} from '@jest/globals'

import {UserRole} from '@api/users/domain'

import {TestContext, testContextE2e} from '../test-context.e2e'
import {Api, createSession, randomId} from '../../util/test.util'
import {ALL, DAY, discountTracker, discountUseCases, isoFromNow, line, scope, TestLine} from './discount-test.util'

describe('Pricing: product discounts (e2e)', () => {
    let ctx: TestContext
    let admin: Api
    let discounts: ReturnType<typeof discountTracker>
    let priceItems: ReturnType<typeof discountUseCases>['priceItems']
    let uc: ReturnType<typeof discountUseCases>

    beforeAll(async () => {
        ctx = await testContextE2e()
        admin = new Api(ctx.app, await createSession(ctx, UserRole.ADMIN))
        discounts = discountTracker(admin)
        uc = discountUseCases(ctx.app)
        priceItems = uc.priceItems
    })

    afterEach(async () => {
        await discounts.cleanup()
    })

    const price = (lines: TestLine[]) => priceItems.execute({userId: randomId(), lines, couponCode: null})
    const priceOne = async (l: TestLine) => (await price([l])).lines[0]

    it('returns untouched prices when nothing matches', async () => {
        const l = line()

        const result = await price([l])

        expect(result).toEqual({
            lines: [{
                variantId: l.variantId,
                originalUnitPrice: 1000,
                unitPrice: 1000,
                appliedDiscountIds: [],
                couponAllocation: 0
            }],
            coupon: {status: 'none'},
        })
    })

    it('handles an empty cart', async () => {
        expect(await price([])).toEqual({lines: [], coupon: {status: 'none'}})
    })

    describe('amounts', () => {
        it.each([
            ['percent', 10, 1000, 900],
            ['percent', 15, 999, 850], // floor(149.85) = 149
            ['percent', 33, 100, 67],
            ['percent', 100, 1000, 0],
            ['fixed', 200, 1000, 800],
            ['fixed', 5000, 1000, 0], // never below zero
        ])('%s %d off %d gives %d', async (kind, value, unitPrice, expected) => {
            const l = line({unitPrice})
            const d = await discounts.create({kind, value, scope: scope('variant', l.variantId)})

            expect(await priceOne(l)).toEqual({
                variantId: l.variantId,
                originalUnitPrice: unitPrice,
                unitPrice: expected,
                appliedDiscountIds: [d.id],
                couponAllocation: 0,
            })
        })

        it('does not apply a discount whose amount rounds down to zero', async () => {
            const l = line({unitPrice: 50})
            await discounts.create({kind: 'percent', value: 1, scope: scope('variant', l.variantId)})

            expect(await priceOne(l)).toMatchObject({unitPrice: 50, appliedDiscountIds: []})
        })

        it('caps the discount per unit', async () => {
            const l = line({unitPrice: 10000})
            await discounts.create({
                kind: 'percent',
                value: 50,
                maxDiscountPerUnit: 1000,
                scope: scope('variant', l.variantId)
            })

            expect((await priceOne(l)).unitPrice).toBe(9000)
        })

        it('does not depend on the quantity', async () => {
            const [one, many] = [line({quantity: 1}), line({quantity: 7})]
            await discounts.create({value: 10, scope: ALL})

            expect((await priceOne(one)).unitPrice).toBe(900)
            expect((await priceOne(many)).unitPrice).toBe(900)
        })
    })

    describe('scope', () => {
        it.each([
            ['variant', 'variantId'],
            ['product', 'productId'],
            ['category', 'categoryId'],
            ['brand', 'brandId'],
        ] as const)('a %s discount applies only to matching lines', async (type, field) => {
            const id = randomId()
            const matching = line({[field]: id} as Partial<TestLine>)
            const other = line({[field]: randomId()} as Partial<TestLine>)
            const d = await discounts.create({value: 10, scope: scope(type, id, randomId())})

            const result = await price([matching, other])

            expect(result.lines[0]).toMatchObject({unitPrice: 900, appliedDiscountIds: [d.id]})
            expect(result.lines[1]).toMatchObject({unitPrice: 1000, appliedDiscountIds: []})
        })

        it('category and brand discounts never match lines without a category or brand', async () => {
            const l = line({categoryId: null, brandId: null})
            await discounts.create({value: 10, scope: scope('category', randomId())})
            await discounts.create({value: 10, scope: scope('brand', randomId())})

            expect((await priceOne(l)).appliedDiscountIds).toEqual([])
        })

        it('an "all" discount applies to every line', async () => {
            const lines = [line(), line({unitPrice: 2000})]
            await discounts.create({value: 10, scope: ALL})

            expect((await price(lines)).lines.map((l) => l.unitPrice)).toEqual([900, 1800])
        })
    })

    describe('choosing between discounts', () => {
        it('applies only the best one, they do not stack', async () => {
            const l = line()
            const small = await discounts.create({value: 10, scope: scope('variant', l.variantId)})
            const big = await discounts.create({value: 30, scope: scope('variant', l.variantId)})
            await discounts.create({value: 20, scope: ALL})

            const result = await priceOne(l)

            expect(result.unitPrice).toBe(700)
            expect(result.appliedDiscountIds).toEqual([big.id])
            expect(result.appliedDiscountIds).not.toContain(small.id)
        })

        it('compares the amount after the per-unit cap', async () => {
            const l = line({unitPrice: 10000})
            await discounts.create({value: 50, maxDiscountPerUnit: 1000, scope: scope('variant', l.variantId)})
            const smaller = await discounts.create({value: 20, scope: scope('variant', l.variantId)}) // 2000

            expect(await priceOne(l)).toMatchObject({unitPrice: 8000, appliedDiscountIds: [smaller.id]})
        })

        it('breaks ties with the smallest discount id', async () => {
            const l = line()
            const a = await discounts.create({kind: 'percent', value: 10, scope: scope('variant', l.variantId)})
            const b = await discounts.create({kind: 'fixed', value: 100, scope: scope('variant', l.variantId)})

            const result = await priceOne(l)

            expect(result.unitPrice).toBe(900)
            expect(result.appliedDiscountIds).toEqual([[a.id, b.id].sort()[0]])
        })

        it('prices every line independently and keeps the line order', async () => {
            const [a, b, c] = [line({unitPrice: 1000}), line({unitPrice: 2000}), line({unitPrice: 3000})]
            await discounts.create({value: 50, scope: scope('variant', b.variantId)})

            const result = await price([a, b, c])

            expect(result.lines.map((l) => [l.variantId, l.unitPrice])).toEqual([
                [a.variantId, 1000],
                [b.variantId, 1000],
                [c.variantId, 3000],
            ])
        })
    })

    describe('activity and period', () => {
        it('ignores inactive discounts', async () => {
            const l = line()
            await discounts.create({value: 10, isActive: false, scope: scope('variant', l.variantId)})

            expect((await priceOne(l)).appliedDiscountIds).toEqual([])
        })

        it('ignores discounts that have not started yet or already ended', async () => {
            const l = line()
            await discounts.create({value: 10, startsAt: isoFromNow(DAY), scope: scope('variant', l.variantId)})
            await discounts.create({
                value: 10,
                startsAt: isoFromNow(-2 * DAY),
                endsAt: isoFromNow(-DAY),
                scope: scope('variant', l.variantId)
            })

            expect((await priceOne(l)).appliedDiscountIds).toEqual([])
        })

        it('applies discounts inside their period and open-ended ones', async () => {
            const l = line()
            const windowed = await discounts.create({
                value: 10,
                startsAt: isoFromNow(-DAY),
                endsAt: isoFromNow(DAY),
                scope: scope('variant', l.variantId)
            })
            const open = await discounts.create({
                value: 20,
                startsAt: isoFromNow(-DAY),
                scope: scope('variant', l.variantId)
            })

            expect((await priceOne(l)).appliedDiscountIds).toEqual([open.id])
            await admin.delete(`/admin/discounts/${open.id}`)
            expect((await priceOne(l)).appliedDiscountIds).toEqual([windowed.id])
        })
    })

    describe('admin changes take effect immediately', () => {
        it('follows edits, deactivation and deletion', async () => {
            const l = line()
            const d = await discounts.create({value: 10, scope: scope('variant', l.variantId)})
            expect((await priceOne(l)).unitPrice).toBe(900)

            await admin.patch(`/admin/discounts/${d.id}`, {value: 25})
            expect((await priceOne(l)).unitPrice).toBe(750)

            await admin.patch(`/admin/discounts/${d.id}`, {scope: scope('variant', randomId())})
            expect((await priceOne(l)).unitPrice).toBe(1000)

            await admin.patch(`/admin/discounts/${d.id}`, {scope: scope('variant', l.variantId), isActive: false})
            expect((await priceOne(l)).unitPrice).toBe(1000)

            await admin.patch(`/admin/discounts/${d.id}`, {isActive: true, value: 10})
            expect((await priceOne(l)).unitPrice).toBe(900)

            await admin.delete(`/admin/discounts/${d.id}`)
            expect((await priceOne(l)).unitPrice).toBe(1000)
        })
    })

    describe('PriceCatalog (product cards, no user, no coupon)', () => {
        const catalog = (lines: TestLine[]) => uc.priceCatalog.execute({lines})

        it('returns the original and discounted unit price per variant, and nothing else', async () => {
            const l = line({unitPrice: 1000})
            await discounts.create({value: 10, scope: scope('variant', l.variantId)})

            expect(await catalog([l])).toEqual({
                lines: [{variantId: l.variantId, originalUnitPrice: 1000, unitPrice: 900}],
            })
        })

        it('handles an empty list', async () => {
            expect(await catalog([])).toEqual({lines: []})
        })

        it('ignores the quantity and keeps the line order', async () => {
            const [a, b] = [line({unitPrice: 1000, quantity: 7}), line({unitPrice: 2000, quantity: 1})]
            await discounts.create({value: 50, scope: scope('variant', b.variantId)})

            const result = await catalog([a, b])

            expect(result.lines.map((l) => [l.variantId, l.unitPrice])).toEqual([[a.variantId, 1000], [b.variantId, 1000]])
        })

        it('chooses the best discount and respects scope, activity and period like the cart does', async () => {
            const l = line({unitPrice: 1000, categoryId: randomId()})
            await discounts.create({value: 10, scope: scope('category', l.categoryId!)})
            await discounts.create({value: 30, scope: scope('variant', l.variantId)})
            await discounts.create({value: 90, isActive: false, scope: scope('variant', l.variantId)})
            await discounts.create({value: 90, startsAt: isoFromNow(DAY), scope: scope('variant', l.variantId)})

            expect((await catalog([l])).lines[0].unitPrice).toBe(700)
        })

        it('matches PRICE_ITEMS without a coupon', async () => {
            const l = line({unitPrice: 1234})
            await discounts.create({value: 15, scope: scope('variant', l.variantId)})

            const viaCatalog = (await catalog([l])).lines[0]
            const viaItems = (await price([l])).lines[0]

            expect([viaCatalog.originalUnitPrice, viaCatalog.unitPrice]).toEqual([viaItems.originalUnitPrice, viaItems.unitPrice])
        })
    })
})
