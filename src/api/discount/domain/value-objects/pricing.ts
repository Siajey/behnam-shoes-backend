export type CouponInvalidReason =
    | 'notFound'
    | 'inactive'
    | 'notStarted'
    | 'expired'
    | 'totalLimitReached'
    | 'userLimitReached'
    | 'minOrderNotMet'
    | 'noEligibleItems'

export interface PricedLine {
    variantId: string
    originalUnitPrice: number
    unitPrice: number
    appliedDiscountIds: string[]
    couponAllocation: number
}

export type CouponOutcome =
    | { status: 'none' }
    | { status: 'applied'; couponId: string; code: string; discount: number }
    | { status: 'invalid'; code: string; reason: CouponInvalidReason }

export interface PricingResult {
    lines: PricedLine[]
    coupon: CouponOutcome
}