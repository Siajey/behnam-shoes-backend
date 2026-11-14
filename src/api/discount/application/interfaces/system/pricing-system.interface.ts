import { PricingLine, PricingResult } from '@api/discount/domain'

export interface PriceItemsCommand {
    userId: string
    lines: PricingLine[]
    couponCode: string | null
}

export type PriceItemsResult = PricingResult

export interface ReserveCouponCommand {
    couponId: string
    userId: string
    orderId: string
    discountAmount: number
}

export interface IPriceItems {
    execute(command: PriceItemsCommand): Promise<PriceItemsResult>
}
export interface IReserveCoupon {
    execute(command: ReserveCouponCommand): Promise<void>
}
export interface ICommitCouponRedemption {
    execute(orderId: string): Promise<void>
}
export interface IReleaseCouponRedemption {
    execute(orderId: string): Promise<void>
}