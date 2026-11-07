import {
    createProduct,
    IBrandRepository,
    ICategoryRepository,
    IProductRepository,
    IVariantRepository,
    Product,
    ProductNotFoundError,
    ProductSlugAlreadyExistsError,
    ProductTypeMismatchError,
    ProductWithVariants,
    VariantNotFoundError,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { assertReferencesExist, unpublishIfNoActiveVariants } from '../../../helpers'
import { ISplitProduct, SplitProductCommand, SplitProductResult } from '../../../interfaces'

export default class SplitProductUseCase implements ISplitProduct {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly categories: ICategoryRepository,
        private readonly brands: IBrandRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: SplitProductCommand, actorId: string): Promise<SplitProductResult> {
        const source = await this.products.findById(command.productId)
        if (!source) throw new ProductNotFoundError({ id: command.productId })

        const data = command.newProduct
        if (data.type !== source.type) throw new ProductTypeMismatchError(data.type)
        if (await this.products.slugExists(data.slug)) throw new ProductSlugAlreadyExistsError(data.slug)
        await assertReferencesExist(this.categories, this.brands, data)

        const all = await this.variants.findByProductId(source.id)
        const ids = new Set(command.variantIds)
        const unknown = [...ids].filter((id) => !all.some((v) => v.id === id))
        if (unknown.length) throw new VariantNotFoundError({ ids: unknown })

        const moving = all.filter((v) => ids.has(v.id))
        const remaining = all.filter((v) => !ids.has(v.id))

        const created = createProduct({
            ...data,
            categoryId: data.categoryId ?? source.categoryId,
            brandId: data.brandId ?? source.brandId,
        })
        created.assertAcceptsVariants(moving)
        moving.forEach((v) => v.assignTo(created.id))

        const changed: Product[] = [created]
        if (unpublishIfNoActiveVariants(source, remaining)) changed.push(source)

        await this.products.saveChanges({ products: changed, variants: moving })

        void this.logger.info('Product split', {
            module: 'SplitProductUseCase',
            operation: 'execute',
            event: 'product.split',
            userId: actorId,
            resourceId: created.id,
            data: {
                sourceProductId: source.id,
                variantCount: moving.length,
                sourceUnpublished: changed.includes(source),
            },
        })
        return {
            source: new ProductWithVariants(source, remaining),
            created: new ProductWithVariants(created, moving),
        }
    }
}