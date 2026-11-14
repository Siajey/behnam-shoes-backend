import { CouponUsage, ReserveOutcome, ReserveRedemptionInput } from '../value-objects'

export interface ICouponRedemptionRepository {
    countActive(couponId: string): Promise<number>
    countActiveForUser(couponId: string, userId: string): Promise<number>
    reserveIfAllowed(input: ReserveRedemptionInput): Promise<ReserveOutcome>

    commit(orderId: string): Promise<void>
    release(orderId: string): Promise<void>

    hasAny(couponId: string): Promise<boolean>
    usage(couponId: string): Promise<CouponUsage>
}