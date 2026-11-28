import {
    CatalogFilters,
    IProductQueryRepository,
    ProductListCriteria,
    ProductPage,
    ProductSearchCriteria,
    ProductStatus,
    ProductWithVariants,
} from '@api/product/domain'

import {CATALOG_CACHE_TTL, CatalogCache} from '../cache'

export class CachedProductQueryRepository implements IProductQueryRepository {
    constructor(
        private readonly inner: IProductQueryRepository,
        private readonly cache: CatalogCache,
    ) {
    }

    findAll(criteria: ProductListCriteria): Promise<ProductPage> {
        return this.inner.findAll(criteria)
    }

    search(criteria: ProductSearchCriteria): Promise<ProductPage> {
        return this.inner.search(criteria)
    }

    findDetailsById(id: string, statuses: ProductStatus[]): Promise<ProductWithVariants | null> {
        return this.inner.findDetailsById(id, statuses)
    }

    findDetailsByIds(ids: string[], statuses: ProductStatus[]): Promise<ProductWithVariants[]> {
        return this.inner.findDetailsByIds(ids, statuses)
    }

    findPublishedIds(ids: string[]): Promise<string[]> {
        return this.inner.findPublishedIds(ids)
    }

    findDetailsBySlug(slug: string, statuses: ProductStatus[]): Promise<ProductWithVariants | null> {
        return this.inner.findDetailsBySlug(slug, statuses)
    }


    getFilters(criteria: Pick<ProductListCriteria, 'statuses' | 'categoryId'>): Promise<CatalogFilters> {
        return this.cache.remember(
            CATALOG_CACHE_TTL.filters,
            ['filters', [...criteria.statuses].sort().join(','), criteria.categoryId],
            () => this.inner.getFilters(criteria),
        )
    }
}