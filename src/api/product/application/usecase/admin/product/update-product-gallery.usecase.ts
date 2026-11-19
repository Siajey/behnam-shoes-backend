import {IProductRepository, Product, ProductNotFoundError} from '@api/product/domain'
import {ILogger} from '@common/logger'

import {
    IUpdateProductGallery,
    UpdateProductGalleryCommand,
} from '../../../interfaces'
import {IFileStorage} from "@common/storage";
import {PRODUCT_IMAGE_UPLOAD_POLICY} from "@api/product/application";

export default class UpdateProductGalleryUseCase implements IUpdateProductGallery {
    constructor(
        private readonly products: IProductRepository,
        private readonly fileStorage: IFileStorage,
        private readonly logger: ILogger,
    ) {
    }

    async execute(command: UpdateProductGalleryCommand, actorId: string): Promise<Product> {
        const product = await this.products.findById(command.productId)
        if (!product) throw new ProductNotFoundError({id: command.productId})
        await verifyNewGalleryImages(this.fileStorage, product.images.map((image) => image.fileKey),
            command.images.map((image) => image.fileKey))
        product.replaceGallery(command.images)
        await this.products.save(product)

        void this.logger.info('Product gallery updated', {
            module: 'UpdateProductGalleryUseCase',
            operation: 'execute',
            event: 'product.gallery.update',
            userId: actorId,
            resourceId: product.id,
            data: {imageCount: command.images.length},
        })
        return product
    }

}

export async function verifyNewGalleryImages(
    storage: IFileStorage,
    existingFileKeys: readonly string[],
    requestedFileKeys: readonly string[],
): Promise<void> {
    const known = new Set(existingFileKeys)
    const added = [...new Set(requestedFileKeys)].filter((key) => !known.has(key))

    await Promise.all(
        added.map((key) => storage.verifyUploaded(PRODUCT_IMAGE_UPLOAD_POLICY, key)),
    )
}