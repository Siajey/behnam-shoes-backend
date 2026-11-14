import { Coupon, Discount } from '../entities'
import {
    CouponInvalidReason, CouponOutcome, discountAmount, PricedLine, PricingLine, PricingResult,
} from '../value-objects'
import { allocateProportionally } from './allocate-proportionally'

export interface CouponContext {
    coupon: Coupon | null
    usage: { total: number; user: number }
}

export interface PricingInput {
    lines: readonly PricingLine[]
    discounts: readonly Discount[]
    couponCode: string | null
    couponContext: CouponContext | null
    now: Date
}

interface Entry {
    source: PricingLine
    priced: PricedLine
}

interface CouponResult {
    outcome: CouponOutcome
    allocations: Map<string, number>
}

export function priceLines(input: PricingInput): PricingResult {
    const entries: Entry[] = input.lines.map((source) => ({
        source,
        priced: applyProductDiscount(source, input.discounts, input.now),
    }))

    const { outcome, allocations } = applyCoupon(entries, input)

    return {
        lines: entries.map(({ priced }) => ({
            ...priced,
            couponAllocation: allocations.get(priced.variantId) ?? 0,
        })),
        coupon: outcome,
    }
}

function applyProductDiscount(line: PricingLine, discounts: readonly Discount[], now: Date): PricedLine {
    let best: { id: string; amount: number } | null = null

    for (const discount of discounts) {
        if (!discount.isActiveAt(now) || !discount.appliesTo(line)) continue
        const amount = discount.discountPerUnit(line.unitPrice)
        if (amount <= 0) continue
        if (!best || amount > best.amount || (amount === best.amount && discount.id < best.id)) {
            best = { id: discount.id, amount }
        }
    }

    return {
        variantId: line.variantId,
        originalUnitPrice: line.unitPrice,
        unitPrice: line.unitPrice - (best?.amount ?? 0),
        appliedDiscountIds: best ? [best.id] : [],
        couponAllocation: 0,
    }
}

const noCoupon = (): CouponResult => ({ outcome: { status: 'none' }, allocations: new Map() })

const invalidCoupon = (code: string, reason: CouponInvalidReason): CouponResult => ({
    outcome: { status: 'invalid', code, reason },
    allocations: new Map(),
})

function applyCoupon(entries: readonly Entry[], input: PricingInput): CouponResult {
    const code = input.couponCode
    if (!code) return noCoupon()

    const context = input.couponContext
    if (!context?.coupon) return invalidCoupon(code, 'notFound')
    const coupon = context.coupon

    const reason = coupon.invalidReason(input.now, context.usage)
    if (reason) return invalidCoupon(code, reason)

    const lineTotal = ({ source, priced }: Entry) => priced.unitPrice * source.quantity

    const orderTotal = entries.reduce((sum, e) => sum + lineTotal(e), 0)
    if (coupon.minOrderAmount !== null && orderTotal < coupon.minOrderAmount) {
        return invalidCoupon(code, 'minOrderNotMet')
    }

    const eligible = entries.filter(
        (e) =>
            coupon.appliesTo(e.source) &&
            (coupon.applyToDiscountedItems || e.priced.appliedDiscountIds.length === 0),
    )
    const eligibleTotal = eligible.reduce((sum, e) => sum + lineTotal(e), 0)
    if (eligibleTotal <= 0) return invalidCoupon(code, 'noEligibleItems')

    let amount = discountAmount(coupon.kind, coupon.value, eligibleTotal)
    if (coupon.maxDiscount !== null) amount = Math.min(amount, coupon.maxDiscount)

    const shares = allocateProportionally(amount, eligible.map(lineTotal))
    const allocations = new Map(eligible.map((e, i) => [e.priced.variantId, shares[i]]))

    return {
        outcome: { status: 'applied', couponId: coupon.id, code: coupon.code, discount: amount },
        allocations,
    }
}