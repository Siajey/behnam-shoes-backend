import { IProductQueryRepository, ProductPage } from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { ISearchProducts, PublicProductSearchQuery } from '../../interfaces'

export default class SearchProductsUseCase implements ISearchProducts {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    execute(query: PublicProductSearchQuery): Promise<ProductPage> {
        return this.productQuery.search({
            ...query,
            q: query.q.trim(),
            statuses: PUBLIC_PRODUCT_STATUSES,
        })
    }
}