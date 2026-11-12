import {ListQuery} from "@common/dto";

import { ProductStatus } from '../value-objects'
import { ProductWithVariants } from '../views'

export const PRODUCT_FILTER_FIELDS = ['type', 'brandId'] as const
export const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'minPrice', 'maxPrice'] as const
export type ProductFilterFields = (typeof PRODUCT_FILTER_FIELDS)[number]
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number]

export interface ProductListCriteria extends ListQuery<ProductFilterFields> {
    statuses: ProductStatus[]
    categoryId?: string
    minPrice?: number
    maxPrice?: number
    inStock?: boolean
    attributes?: Record<string, string[]>
}

export interface ProductSearchCriteria extends ProductListCriteria {
    q: string
}

export interface ProductPage {
    products: ProductWithVariants[]
    nextCursor: string | null
}

export interface CatalogFilters {
    categories: { id: string; name: string; slug: string; count: number }[]
    brands: { id: string; name: string; slug: string; count: number }[]
    priceRange: { min: number; max: number } | null
    attributes: { name: string; values: { value: string; count: number }[] }[]
}

export interface IProductQueryRepository {
    findAll(criteria: ProductListCriteria): Promise<ProductPage>
    search(criteria: ProductSearchCriteria): Promise<ProductPage>
    findDetailsById(id: string, statuses: ProductStatus[]): Promise<ProductWithVariants | null>
    findDetailsBySlug(slug: string, statuses: ProductStatus[]): Promise<ProductWithVariants | null>
    getFilters(criteria: Pick<ProductListCriteria, 'statuses' | 'categoryId'>): Promise<CatalogFilters>
}