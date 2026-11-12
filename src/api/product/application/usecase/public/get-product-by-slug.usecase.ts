import { IProductQueryRepository, ProductNotFoundError, ProductWithVariants } from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { IGetProductBySlug } from '../../interfaces'

export default class GetProductBySlugUseCase implements IGetProductBySlug {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    async execute(slug: string): Promise<ProductWithVariants> {
        const product = await this.productQuery.findDetailsBySlug(slug, PUBLIC_PRODUCT_STATUSES)
        if (!product) throw new ProductNotFoundError({ slug })
        return product
    }
}