import {IProductQueryRepository, IProductRatingRepository, IProductStatsRepository} from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { enrichWithMeta } from '../../helpers'
import { IListProducts, ProductMetaPage, PublicProductListQuery } from '../../interfaces'
import { IProductPricing } from '../../ports'

export default class ListProductsUseCase implements IListProducts {
    constructor(
        private readonly productQuery: IProductQueryRepository,
        private readonly pricing: IProductPricing,
        private readonly stats: IProductStatsRepository,
        private readonly ratings: IProductRatingRepository
    ) {}

    async execute(query: PublicProductListQuery): Promise<ProductMetaPage> {
        const page = await this.productQuery.findAll({ ...query, statuses: PUBLIC_PRODUCT_STATUSES })
        return {
            products: await enrichWithMeta(this.pricing, this.stats,this.ratings, page.products),
            nextCursor: page.nextCursor,
        }
    }
}