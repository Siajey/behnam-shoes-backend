import {
    IProductRepository,
    IVariantRepository,
    Product,
    ProductNotFoundError,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { IPublishProduct } from '../../../interfaces'

export default class PublishProductUseCase implements IPublishProduct {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(productId: string, actorId: string): Promise<Product> {
        const product = await this.products.findById(productId)
        if (!product) throw new ProductNotFoundError({ id: productId })

        product.publish(await this.variants.findByProductId(productId))
        await this.products.save(product)

        void this.logger.info('Product published', {
            module: 'PublishProductUseCase',
            operation: 'execute',
            event: 'product.publish',
            userId: actorId,
            resourceId: product.id,
        })
        return product
    }
}