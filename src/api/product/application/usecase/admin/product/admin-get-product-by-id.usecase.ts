import {
    IProductQueryRepository,
    PRODUCT_STATUSES,
    ProductNotFoundError,
    ProductWithVariants,
} from '@api/product/domain'

import { IAdminGetProductById } from '../../../interfaces'

export default class AdminGetProductByIdUseCase implements IAdminGetProductById {
    constructor(private readonly productQuery: IProductQueryRepository) {}

    async execute(id: string): Promise<ProductWithVariants> {
        const product = await this.productQuery.findDetailsById(id, [...PRODUCT_STATUSES])
        if (!product) throw new ProductNotFoundError({ id })
        return product
    }
}