import { ListQuery } from '@common/dto'

import { Discount } from '../entities'

export const DISCOUNT_FILTER_FIELDS = ['isActive'] as const
export const DISCOUNT_SORT_FIELDS = ['createdAt', 'name'] as const
export type DiscountFilterField = (typeof DISCOUNT_FILTER_FIELDS)[number]
export type DiscountListCriteria = ListQuery<DiscountFilterField>

export interface DiscountPage {
    discounts: Discount[]
    nextCursor: string | null
}

export interface IDiscountRepository {
    findById(id: string): Promise<Discount | null>
    findActiveAt(now: Date): Promise<Discount[]>
    findAll(criteria: DiscountListCriteria): Promise<DiscountPage>
    save(discount: Discount): Promise<void>
    delete(id: string): Promise<void>
}