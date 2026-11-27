import {IProductQueryRepository, IProductRatingRepository, IProductStatsRepository} from '@api/product/domain'

import {ISearchProducts, ProductMetaPage, PublicProductSearchQuery} from '../../interfaces'
import {enrichWithMeta} from "@api/product/application";
import {IProductPricing} from "@api/product/application/ports";

import {PUBLIC_PRODUCT_STATUSES} from '../../constants'

export default class SearchProductsUseCase implements ISearchProducts {
    constructor(
        private readonly productQuery: IProductQueryRepository,
        private readonly pricing: IProductPricing,
        private readonly stats: IProductStatsRepository,
        private readonly ratings: IProductRatingRepository
    ) {
    }

    async execute(query: PublicProductSearchQuery): Promise<ProductMetaPage> {
        const page = await this.productQuery.search({
            ...query,
            q: query.q.trim(),
            statuses: PUBLIC_PRODUCT_STATUSES,
        })
        return {
            products: await enrichWithMeta(this.pricing, this.stats, this.ratings, page.products),
            nextCursor: page.nextCursor,
        }
    }
}