import {
    AdminProductListQuery,
    PublicProductListQuery,
    PublicProductSearchQuery,
} from '@api/product/application'

import { AdminListProductsQuery, ListProductsQuery, SearchProductsQuery } from '../dtos'

export function toProductListQuery(q: ListProductsQuery): PublicProductListQuery {
    return {
        pageSize: q.pageSize,
        sort: q.sort,
        nextCursor: q.nextCursor,
        filterFields: { type: q.type, brandId: q.brandId},
        categoryId: q.categoryId,
        minPrice: q.minPrice,
        maxPrice: q.maxPrice,
        inStock: q.inStock,
        attributes: q.attributes,
    }
}

export function toProductSearchQuery(q: SearchProductsQuery): PublicProductSearchQuery {
    return { ...toProductListQuery(q), q: q.q }
}

export function toAdminProductListQuery(q: AdminListProductsQuery): AdminProductListQuery {
    return { ...toProductListQuery(q), statuses: q.statuses, q: q.q }
}