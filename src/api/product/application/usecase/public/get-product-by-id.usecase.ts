import { IProductQueryRepository, ProductNotFoundError, ProductWithVariants } from '@api/product/domain'

import { PUBLIC_PRODUCT_STATUSES } from '../../constants'
import { IGetProductById } from '../../interfaces'

export default class GetProductByIdUseCase implements IGetProductById {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    async execute(id: string): Promise<ProductWithVariants> {
        const product = await this.productQuery.findDetailsById(id, PUBLIC_PRODUCT_STATUSES)
        if (!product) throw new ProductNotFoundError({ id })
        return product
    }
}