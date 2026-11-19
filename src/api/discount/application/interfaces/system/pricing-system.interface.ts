import { PricingLine, PricingResult } from '@api/discount/domain'

export interface PriceCatalogCommand {
    lines: PricingLine[]
}

export interface PriceCatalogResult {
    lines: { variantId: string; originalUnitPrice: number; unitPrice: number }[]
}

export interface IPriceCatalog {
    execute(command: PriceCatalogCommand): Promise<PriceCatalogResult>
}

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