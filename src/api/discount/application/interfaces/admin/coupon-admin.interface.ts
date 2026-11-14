import {
    Coupon, CouponListCriteria, CouponPage, CouponUsage, DiscountKind, DiscountScope,
} from '@api/discount/domain'

export interface CreateCouponCommand {
    code: string
    name: string
    kind: DiscountKind
    value: number
    maxDiscount?: number | null
    minOrderAmount?: number | null
    scope: DiscountScope
    applyToDiscountedItems?: boolean
    startsAt?: Date | null
    endsAt?: Date | null
    usageLimitTotal?: number | null
    usageLimitPerUser?: number | null
    isActive?: boolean
}

export interface EditCouponCommand {
    id: string
    name?: string
    kind?: DiscountKind
    value?: number
    maxDiscount?: number | null
    minOrderAmount?: number | null
    scope?: DiscountScope
    applyToDiscountedItems?: boolean
    startsAt?: Date | null
    endsAt?: Date | null
    usageLimitTotal?: number | null
    usageLimitPerUser?: number | null
    isActive?: boolean
}

export interface IListCoupons {
    execute(query: CouponListCriteria): Promise<CouponPage>
}
export interface IGetCoupon {
    execute(id: string): Promise<Coupon>
}
export interface ICreateCoupon {
    execute(command: CreateCouponCommand, actorId: string): Promise<Coupon>
}
export interface IEditCoupon {
    execute(command: EditCouponCommand, actorId: string): Promise<Coupon>
}
export interface IDeleteCoupon {
    execute(id: string, actorId: string): Promise<void>
}
export interface IGetCouponUsage {
    execute(id: string): Promise<CouponUsage>
}