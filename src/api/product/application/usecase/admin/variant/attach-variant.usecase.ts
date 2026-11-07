import {
    IProductRepository,
    IVariantRepository,
    ProductNotFoundError,
    ProductWithVariants,
} from '@api/product/domain'
import { ILogger } from '@common/logger'

import { loadAssignableVariants } from '../../../helpers'
import { AttachVariantsCommand, IAttachVariants } from '../../../interfaces'

export default class AttachVariantsUseCase implements IAttachVariants {
    constructor(
        private readonly products: IProductRepository,
        private readonly variants: IVariantRepository,
        private readonly logger: ILogger,
    ) {}

    async execute(command: AttachVariantsCommand, actorId: string): Promise<ProductWithVariants> {
        const product = await this.products.findById(command.productId)
        if (!product) throw new ProductNotFoundError({ id: command.productId })

        const attaching = await loadAssignableVariants(this.variants, command.variantIds)
        product.assertAcceptsVariants(attaching)

        const existing = await this.variants.findByProductId(product.id)
        attaching.forEach((v) => v.assignTo(product.id))
        await this.variants.saveMany(attaching)

        void this.logger.info('Variants attached to product', {
            module: 'AttachVariantsUseCase',
            operation: 'execute',
            event: 'product.variant.attach',
            userId: actorId,
            resourceId: product.id,
            data: { variantCount: attaching.length },
        })
        return new ProductWithVariants(product, [...existing, ...attaching])
    }
}