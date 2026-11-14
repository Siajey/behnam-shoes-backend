import { ListQuery } from '@common/dto'

import { Coupon } from '../entities'

export const COUPON_FILTER_FIELDS = ['isActive'] as const
export const COUPON_SORT_FIELDS = ['createdAt', 'code'] as const
export type CouponFilterField = (typeof COUPON_FILTER_FIELDS)[number]
export type CouponListCriteria = ListQuery<CouponFilterField>

export interface CouponPage {
    coupons: Coupon[]
    nextCursor: string | null
}

export interface ICouponRepository {
    findById(id: string): Promise<Coupon | null>
    findByCode(code: string): Promise<Coupon | null>
    codeExists(code: string): Promise<boolean>
    findAll(criteria: CouponListCriteria): Promise<CouponPage>
    save(coupon: Coupon): Promise<void>
    delete(id: string): Promise<void>
}