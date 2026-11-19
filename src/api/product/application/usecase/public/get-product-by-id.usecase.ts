import {
    IProductQueryRepository, IProductStatsRepository, ProductNotFoundError, ProductWithMeta,
} from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { enrichWithMeta } from '../../helpers'
import { IGetProductById } from '../../interfaces'
import { IProductPricing } from '../../ports'

export default class GetProductByIdUseCase implements IGetProductById {
    constructor(
        private readonly productQuery: IProductQueryRepository,
        private readonly pricing: IProductPricing,
        private readonly stats: IProductStatsRepository,
    ) {}

    async execute(id: string): Promise<ProductWithMeta> {
        const view = await this.productQuery.findDetailsById(id, PUBLIC_PRODUCT_STATUSES)
        if (!view) throw new ProductNotFoundError({ id })

        const [item] = await enrichWithMeta(this.pricing, this.stats, [view])
        return item
    }
}