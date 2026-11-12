import { CatalogFilters, IProductQueryRepository } from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { IGetCatalogFilters } from '../../interfaces'

export default class GetCatalogFiltersUseCase implements IGetCatalogFilters {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    execute(query: { categoryId?: string }): Promise<CatalogFilters> {
        return this.productQuery.getFilters({
            statuses: PUBLIC_PRODUCT_STATUSES,
            categoryId: query.categoryId,
        })
    }
}