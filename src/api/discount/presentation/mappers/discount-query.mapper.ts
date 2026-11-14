import { CouponListCriteria, DiscountListCriteria } from '@api/discount/domain'

import { ListDiscountsQuery } from '../dto'

export function toListCriteria(query: ListDiscountsQuery): DiscountListCriteria & CouponListCriteria {
    return {
        pageSize: query.pageSize,
        sort: query.sort,
        nextCursor: query.nextCursor,
        filterFields: { isActive: query.isActive }, // handled by the query builder
    }
}