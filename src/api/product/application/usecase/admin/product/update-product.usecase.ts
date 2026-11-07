import {
    IBrandRepository,
    ICategoryRepository,
    IProductRepository,
    IVariantRepository,
    ProductNotFoundError,
    ProductSlugAlreadyExistsError,
    ProductTypeMismatchError,
    ProductWithVariants,
    ShoeProduct,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { assertReferencesExist } from '../../../helpers'
import { IUpdateProduct, UpdateProductCommand } from '../../../interfaces'

export default class UpdateProductUseCase implements IUpdateProduct {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly categories: ICategoryRepository,
        private readonly brands: IBrandRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: UpdateProductCommand, actorId: string): Promise<ProductWithVariants> {
        const product = await this.products.findById(command.id)
        if (!product) throw new ProductNotFoundError({ id: command.id })

        await assertReferencesExist(this.categories, this.brands, command)

        if (command.slug !== undefined && command.slug !== product.slug) {
            if (await this.products.slugExists(command.slug, product.id)) {
                throw new ProductSlugAlreadyExistsError(command.slug)
            }
            product.changeSlug(command.slug)
        }

        product.updateDetails({
            name: command.name,
            description: command.description,
            categoryId: command.categoryId,
            brandId: command.brandId,
        })

        if (command.shoe) {
            if (!(product instanceof ShoeProduct)) throw new ProductTypeMismatchError(product.type)
            product.updateShoeDetails(command.shoe)
        }

        await this.products.save(product)

        void this.logger.info('Product updated', {
            module: 'UpdateProductUseCase',
            operation: 'execute',
            event: 'product.update',
            userId: actorId,
            resourceId: product.id,
        })
        return new ProductWithVariants(product, await this.variants.findByProductId(product.id))
    }
}