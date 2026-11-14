export const REDEMPTION_STATUSES = ['reserved', 'committed', 'released'] as const
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number]

export interface CouponUsage {
    reserved: number
    committed: number
    released: number
    totalDiscount: number
}

export type ReserveOutcome = 'reserved' | 'totalLimitReached' | 'userLimitReached'

export interface ReserveRedemptionInput {
    couponId: string
    userId: string
    orderId: string
    discountAmount: number
}