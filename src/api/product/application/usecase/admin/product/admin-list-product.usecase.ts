import { IProductQueryRepository, PRODUCT_STATUSES, ProductPage } from '@api/product/domain'

import { AdminProductListQuery, IAdminListProducts } from '../../../interfaces'

export default class AdminListProductsUseCase implements IAdminListProducts {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    execute(query: AdminProductListQuery): Promise<ProductPage> {
        const { q, statuses, ...rest } = query
        const criteria = { ...rest, statuses: statuses?.length ? statuses : [...PRODUCT_STATUSES] }
        const term = q?.trim()

        return term
            ? this.productQuery.search({ ...criteria, q: term })
            : this.productQuery.findAll(criteria)
    }
}