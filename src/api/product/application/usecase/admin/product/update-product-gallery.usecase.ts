import { IProductRepository, Product, ProductNotFoundError } from '@api/product/domain'
import { ILogger } from '@common/logger'

import {
    IUpdateProductGallery,
    UpdateProductGalleryCommand,
} from '../../../interfaces'

export default class UpdateProductGalleryUseCase implements IUpdateProductGallery {
    constructor(
        private readonly products: IProductRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: UpdateProductGalleryCommand, actorId: string): Promise<Product> {
        const product = await this.products.findById(command.productId)
        if (!product) throw new ProductNotFoundError({ id: command.productId })

        product.replaceGallery(command.images)
        await this.products.save(product)

        void this.logger.info('Product gallery updated', {
            module: 'UpdateProductGalleryUseCase',
            operation: 'execute',
            event: 'product.gallery.update',
            userId: actorId,
            resourceId: product.id,
            data: { imageCount: command.images.length },
        })
        return product
    }
}