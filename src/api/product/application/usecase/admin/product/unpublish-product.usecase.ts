import { IProductRepository, Product, ProductNotFoundError } from '@api/product/domain'
import { ILogger } from '@common/logger'

import { IUnpublishProduct } from '../../../interfaces'

export default class UnpublishProductUseCase implements IUnpublishProduct {
    constructor(
        private readonly products: IProductRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(productId: string, actorId: string): Promise<Product> {
        const product = await this.products.findById(productId)
        if (!product) throw new ProductNotFoundError({ id: productId })

        product.unpublish()
        await this.products.save(product)

        void this.logger.info('Product unpublished', {
            module: 'UnpublishProductUseCase',
            operation: 'execute',
            event: 'product.unpublish',
            userId: actorId,
            resourceId: product.id,
        })
        return product
    }
}