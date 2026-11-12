import { IProductQueryRepository, ProductPage } from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { IListProducts, PublicProductListQuery } from '../../interfaces'

export default class ListProductsUseCase implements IListProducts {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    execute(query: PublicProductListQuery): Promise<ProductPage> {
        return this.productQuery.findAll({ ...query, statuses: PUBLIC_PRODUCT_STATUSES })
    }
}