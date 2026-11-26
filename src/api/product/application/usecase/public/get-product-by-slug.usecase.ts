import {
    IAttributeDefinitionRepository,
    IProductAttributeRepository,
    IProductQueryRepository,
    IProductRatingRepository,
    IProductStatsRepository,
    ProductNotFoundError,
    ProductWithMeta,
} from '@api/product/domain'

import {PUBLIC_PRODUCT_STATUSES} from '../../constants'
import {enrichWithMeta, resolveProductAttributes} from '../../helpers'
import {IGetProductById} from '../../interfaces'
import {IProductPricing} from '../../ports'

export default class GetProductByIdUseCase implements IGetProductById {
    constructor(
        private readonly productQuery: IProductQueryRepository,
        private readonly pricing: IProductPricing,
        private readonly stats: IProductStatsRepository,
        private readonly definitions: IAttributeDefinitionRepository,
        private readonly attributeValues: IProductAttributeRepository,
        private readonly ratings: IProductRatingRepository
    ) {
    }

    async execute(id: string): Promise<ProductWithMeta> {
        const view = await this.productQuery.findDetailsBySlug(id, PUBLIC_PRODUCT_STATUSES)
        if (!view) throw new ProductNotFoundError({id})

        const [[item], attributes] = await Promise.all([enrichWithMeta(this.pricing, this.stats, this.ratings, [view]), resolveProductAttributes(this.definitions, this.attributeValues, view.product.id, true)])
        return {...item, attributes}
    }
}