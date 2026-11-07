import { IProductRepository, Product, ProductNotFoundError } from '@api/product/domain'
import { ILogger } from '@common/logger'

import { IArchiveProduct } from '../../../interfaces'

export default class ArchiveProductUseCase implements IArchiveProduct {
    constructor(
        private readonly products: IProductRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(productId: string, actorId: string): Promise<Product> {
        const product = await this.products.findById(productId)
        if (!product) throw new ProductNotFoundError({ id: productId })

        product.archive()
        await this.products.save(product)

        void this.logger.info('Product archived', {
            module: 'ArchiveProductUseCase',
            operation: 'execute',
            event: 'product.archive',
            userId: actorId,
            resourceId: product.id,
        })
        return product
    }
}