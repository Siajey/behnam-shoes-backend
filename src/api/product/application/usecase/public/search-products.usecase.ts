import {IProductQueryRepository, IProductStatsRepository} from '@api/product/domain'

import {PUBLIC_PRODUCT_STATUSES} from '../../constants'
import {ISearchProducts, ProductMetaPage, PublicProductSearchQuery} from '../../interfaces'
import {enrichWithMeta} from "@api/product/application";
import {IProductPricing} from "@api/product/application/ports";

export default class SearchProductsUseCase implements ISearchProducts {
    constructor(private readonly productQuery: IProductQueryRepository,
                private readonly pricing: IProductPricing,
                private readonly stats: IProductStatsRepository,
    ) {
    }

    async execute(query: PublicProductSearchQuery): Promise<ProductMetaPage> {
        const page = await this.productQuery.search({
            ...query,
            q: query.q.trim(),
            statuses: PUBLIC_PRODUCT_STATUSES,
        })
        return {
            products: await enrichWithMeta(this.pricing, this.stats, page.products),
            nextCursor: page.nextCursor,
        }
    }
}