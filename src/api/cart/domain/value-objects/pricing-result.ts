export type CouponStatus = 'none' | 'applied' | 'invalid'

export interface PricedLine {
    variantId: string
    originalUnitPrice: number
    unitPrice: number
    couponAllocation: number
}

export interface PricingResult {
    lines: PricedLine[]
    couponCode: string | null
    couponStatus: CouponStatus
    couponDiscount: number
}