import {
    createProduct,
    IBrandRepository,
    ICategoryRepository,
    IProductRepository,
    IVariantRepository,
    ProductSlugAlreadyExistsError,
    ProductWithVariants,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { assertReferencesExist,loadAssignableVariants } from '../../../helpers'
import { CreateProductCommand, ICreateProduct } from '../../../interfaces'

export default class CreateProductUseCase implements ICreateProduct {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly categories: ICategoryRepository,
        private readonly brands: IBrandRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: CreateProductCommand, actorId: string): Promise<ProductWithVariants> {
        if (await this.products.slugExists(command.slug)) {
            throw new ProductSlugAlreadyExistsError(command.slug)
        }
        await assertReferencesExist(this.categories, this.brands, command)

        const variants = await loadAssignableVariants(this.variants, command.variantIds ?? [])
        const product = createProduct(command)

        product.assertAcceptsVariants(variants)
        variants.forEach((v) => v.assignTo(product.id))

        await this.products.saveChanges({ products: [product], variants })

        void this.logger.info('Product created', {
            module: 'CreateProductUseCase',
            operation: 'execute',
            event: 'product.create',
            userId: actorId,
            resourceId: product.id,
            data: { type: product.type, variantCount: variants.length },
        })
        return new ProductWithVariants(product, variants)
    }
}