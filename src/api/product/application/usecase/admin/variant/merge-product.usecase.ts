import {
    IProductRepository,
    IVariantRepository,
    ProductMergeSameProductError,
    ProductNotFoundError,
    ProductTypeMismatchError,
    ProductWithVariants,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { IMergeProducts, MergeProductsCommand } from '../../../interfaces'

export default class MergeProductsUseCase implements IMergeProducts {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: MergeProductsCommand, actorId: string): Promise<ProductWithVariants> {
        if (command.sourceProductId === command.targetProductId) {
            throw new ProductMergeSameProductError()
        }

        const [source, target] = await Promise.all([
            this.products.findById(command.sourceProductId),
            this.products.findById(command.targetProductId),
        ])
        if (!source) throw new ProductNotFoundError({ id: command.sourceProductId })
        if (!target) throw new ProductNotFoundError({ id: command.targetProductId })
        if (source.type !== target.type) throw new ProductTypeMismatchError(source.type)

        const [moving, existing] = await Promise.all([
            this.variants.findByProductId(source.id),
            this.variants.findByProductId(target.id),
        ])

        target.assertAcceptsVariants(moving)
        moving.forEach((v) => v.assignTo(target.id))
        if (source.status !== 'archived') source.archive()

        await this.products.saveChanges({ products: [source], variants: moving })

        void this.logger.info('Products merged', {
            module: 'MergeProductsUseCase',
            operation: 'execute',
            event: 'product.merge',
            userId: actorId,
            resourceId: target.id,
            data: { sourceProductId: source.id, variantCount: moving.length },
        })
        return new ProductWithVariants(target, [...existing, ...moving])
    }
}